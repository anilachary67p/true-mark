# Disaster Recovery Runbook

> Backup, restore, and disaster recovery procedures for TrueMark deployments.

## Recovery Objectives

| Metric                             | SaaS Target  | On-Prem Target | Notes                     |
| ---------------------------------- | ------------ | -------------- | ------------------------- |
| **RPO** (Recovery Point Objective) | 1 hour       | 24 hours       | Max acceptable data loss  |
| **RTO** (Recovery Time Objective)  | 4 hours      | 8 hours        | Max acceptable downtime   |
| **RLO** (Recovery Level Objective) | Full service | Full service   | All capabilities restored |

---

## Critical Assets

| Asset                               | Location                      | Backup Method                     | Priority      |
| ----------------------------------- | ----------------------------- | --------------------------------- | ------------- |
| PostgreSQL database                 | RDS / on-prem                 | Automated snapshots + PITR        | P1 — Critical |
| Object storage (images, QR exports) | S3 / MinIO                    | Cross-region replication / mirror | P2 — High     |
| Redis data                          | ElastiCache / on-prem         | Ephemeral (rebuild from DB)       | P3 — Low      |
| Application configuration           | Helm values / .env            | Git + encrypted backup            | P2 — High     |
| TLS certificates                    | ACM / customer PKI            | Auto-renewal / PKI backup         | P2 — High     |
| Secrets                             | Secrets Manager / Vault       | Provider-native backup            | P1 — Critical |
| Terraform state                     | S3 backend                    | Versioned S3 bucket               | P2 — High     |
| Audit logs                          | PostgreSQL (audit_logs table) | Included in DB backup             | P1 — Critical |

---

## Backup Procedures

### Cloud (AWS)

#### Database — RDS Automated Backups

Configured in Terraform:

```hcl
# infra/terraform/aws/main.tf
backup_retention_period = 35        # days
backup_window           = "03:00-04:00"
maintenance_window      = "Mon:04:00-05:00"
deletion_protection     = true
```

**Manual snapshot before major changes:**

```bash
aws rds create-db-snapshot \
  --db-instance-identifier truemark-production \
  --db-snapshot-identifier truemark-pre-upgrade-$(date +%Y%m%d)
```

**Point-in-time recovery:** RDS supports PITR to any second within retention period.

#### Object Storage — S3

```bash
# Enable versioning (Terraform)
aws s3api put-bucket-versioning \
  --bucket truemark-production-storage \
  --versioning-configuration Status=Enabled

# Cross-region replication (optional)
# Configure in Terraform for DR region
```

#### Secrets — AWS Secrets Manager

```bash
# Secrets auto-replicated if configured
# Manual export for DR documentation (encrypted):
aws secretsmanager get-secret-value \
  --secret-id truemark/production/db-credentials \
  --query SecretString --output text > /secure/backup/db-creds.enc
```

#### Application Configuration

```bash
# Helm values backup
helm get values truemark -n truemark > /secure/backup/helm-values-$(date +%Y%m%d).yaml

# Terraform state (if not in remote backend)
terraform state pull > /secure/backup/tfstate-$(date +%Y%m%d).json
```

### On-Premises

See [On-Prem Install Runbook](./onprem-install.md) Step 7 for automated backup script.

**Daily backup schedule:**

| Time  | Component     | Method                                                       |
| ----- | ------------- | ------------------------------------------------------------ |
| 02:00 | PostgreSQL    | pg_dump → gzip → /opt/truemark/backups/db/                   |
| 02:30 | MinIO         | mc mirror → /opt/truemark/backups/storage/                   |
| 03:00 | Configuration | Copy .env, nginx.conf, certs → /opt/truemark/backups/config/ |

**Offsite backup:** Copy `/opt/truemark/backups/` to secondary location (NAS, tape, encrypted cloud) daily.

---

## Disaster Scenarios

### Scenario 1: Database Corruption / Failure

**Impact:** All verification and admin operations down.  
**RTO:** 2-4 hours (cloud), 4-8 hours (on-prem)

#### Cloud Recovery

```bash
# Option A: Point-in-time recovery (preferred)
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier truemark-production \
  --target-db-instance-identifier truemark-production-restored \
  --restore-time 2026-08-22T10:00:00Z

# Option B: Snapshot restore
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier truemark-production-restored \
  --db-snapshot-identifier truemark-pre-upgrade-20260822

# Update Kubernetes secret with new endpoint
kubectl create secret generic truemark-db-credentials \
  --namespace truemark \
  --from-literal=DATABASE_URL="postgresql://..." \
  --dry-run=client -o yaml | kubectl apply -f -

# Restart API pods
kubectl rollout restart deployment truemark-api -n truemark
```

#### On-Prem Recovery

```bash
# Stop API to prevent writes
docker compose -f infra/docker/docker-compose.onprem.yml stop api worker

# Restore database
gunzip -c /opt/truemark/backups/db/truemark_20260822_020000.sql.gz | \
  docker compose -f infra/docker/docker-compose.onprem.yml exec -T postgres \
  psql -U truemark truemark

# Restart services
docker compose -f infra/docker/docker-compose.onprem.yml up -d
```

#### Post-Recovery Validation

```bash
# 1. Health check
curl -sf https://api.example.com/health/ready

# 2. Verify tenant count
docker compose exec api npx prisma db execute --stdin <<< \
  "SELECT count(*) FROM tenants;"

# 3. Verify latest verification event timestamp
docker compose exec api npx prisma db execute --stdin <<< \
  "SELECT max(created_at) FROM verification_events;"

# 4. Test verification with known QR
curl -X POST https://api.example.com/public/verify/qr \
  -H "Content-Type: application/json" \
  -d '{"url": "https://verify.demo.example.com/v/<known-token>", "hostname": "verify.demo.example.com"}'

# 5. Verify tenant/domain/QR relationships
docker compose exec api npx prisma db execute --stdin <<< \
  "SELECT t.name, vd.hostname, count(qr.id) as qr_count
   FROM tenants t
   JOIN verification_domains vd ON vd.tenant_id = t.id
   LEFT JOIN qr_codes qr ON qr.tenant_id = t.id
   GROUP BY t.name, vd.hostname;"
```

---

### Scenario 2: Complete Region / Datacenter Failure

**Impact:** Total service outage.  
**RTO:** 4 hours (cloud with DR region), 8 hours (on-prem)

#### Cloud — Failover to DR Region

**Prerequisites (configured in advance):**

- RDS cross-region read replica or snapshot in DR region
- S3 cross-region replication
- EKS cluster in DR region (standby or Terraform-ready)
- Route53 health checks with failover routing

**Failover steps:**

```bash
# 1. Promote RDS read replica in DR region
aws rds promote-read-replica \
  --db-instance-identifier truemark-dr-replica \
  --region eu-west-1

# 2. Update Route53 to point to DR region ALB
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890 \
  --change-batch file://failover-to-dr.json

# 3. Deploy application in DR EKS cluster
cd infra/terraform/aws
terraform workspace select dr
terraform apply

helm upgrade --install truemark ../helm/truemark \
  --namespace truemark \
  --values values-dr.yaml

# 4. Run migrations (if needed)
kubectl run truemark-migrate --restart=Never \
  --image=truemark/api:latest \
  --command -- npx prisma migrate deploy

# 5. Smoke tests
curl -sf https://api.truemark.example.com/health/ready
```

#### On-Prem — Failover to Secondary Site

1. Restore latest offsite backup to secondary server
2. Update DNS to point verification domains to secondary
3. Follow database recovery procedure (Scenario 1)
4. Restore MinIO data from offsite backup
5. Run post-recovery validation

---

### Scenario 3: Object Storage Failure

**Impact:** AI image upload/download fails; QR export unavailable. Core verification unaffected.  
**RTO:** 2 hours

#### Cloud (S3)

S3 provides 99.999999999% durability. Recovery from:

- Versioning: restore previous object version
- Cross-region replication: objects available in DR bucket

```bash
# Restore deleted object from versioning
aws s3api list-object-versions \
  --bucket truemark-production-storage \
  --prefix ai/reference/

aws s3api copy-object \
  --bucket truemark-production-storage \
  --copy-source truemark-production-storage/ai/reference/image.jpg?versionId=<version-id> \
  --key ai/reference/image.jpg
```

#### On-Prem (MinIO)

```bash
# Restore from backup mirror
docker compose exec minio mc mirror \
  /backup/storage/latest/ /data/truemark/
```

---

### Scenario 4: Application Corruption / Bad Deployment

**Impact:** API errors, failed verifications. Database intact.  
**RTO:** 30 minutes

```bash
# Cloud: Helm rollback
helm rollback truemark -n truemark

# On-prem: Git rollback + rebuild
cd /opt/truemark/app
git checkout <last-known-good-tag>
docker compose -f infra/docker/docker-compose.onprem.yml build
docker compose -f infra/docker/docker-compose.onprem.yml up -d

# Verify
curl -sf http://localhost:3001/health/ready
```

**Do not restore database** — application rollback does not require DB restore.

---

### Scenario 5: Security Breach / Credential Compromise

**Impact:** Potential unauthorized access or forged verifications.  
**RTO:** Variable (investigation-dependent)

**Immediate actions:**

1. **Isolate:** Restrict network access to affected components
2. **Rotate secrets:**
   ```bash
   # JWT secret
   aws secretsmanager rotate-secret --secret-id truemark/production/jwt-secret

   # Database password
   aws rds modify-db-instance --master-user-password <new-password> \
     --apply-immediately --db-instance-identifier truemark-production

   # AI API keys
   aws secretsmanager rotate-secret --secret-id truemark/production/ai-api-key
   ```
3. **Force logout:** Restart API pods (invalidates JWT sessions)
4. **Audit review:** Query audit_logs for suspicious activity
   ```sql
   SELECT * FROM audit_logs
   WHERE created_at > '<breach-start-time>'
   ORDER BY created_at DESC;
   ```
5. **Assess scope:** Check for unauthorized verification events, credential exports, domain changes
6. **Notify:** Follow incident response procedure
7. **Remediate:** Patch vulnerability, restore from pre-breach backup if data integrity compromised

---

### Scenario 6: Redis Failure

**Impact:** Rate limiting degraded, background jobs paused. Core verification works (DB direct).  
**RTO:** 1 hour

Redis data is **ephemeral** — no backup needed.

```bash
# Cloud: ElastiCache automatic failover (Multi-AZ)
# Verify failover occurred
aws elasticache describe-cache-clusters \
  --cache-cluster-id truemark-redis

# On-prem: Restart Redis
docker compose -f infra/docker/docker-compose.onprem.yml restart redis

# Verify
docker compose exec redis redis-cli ping
# Expected: PONG

# Restart worker to reconnect
docker compose -f infra/docker/docker-compose.onprem.yml restart worker
```

Queued jobs during outage will need re-processing. Check BullMQ failed jobs:

```bash
docker compose exec api node -e "
  const { Queue } = require('bullmq');
  const q = new Queue('bulk-generation', { connection: { host: 'redis' } });
  q.getFailed().then(jobs => console.log(jobs.length, 'failed jobs'));
"
```

---

## DR Drill Schedule

| Drill                        | Frequency     | Scope                                   | Success Criteria                       |
| ---------------------------- | ------------- | --------------------------------------- | -------------------------------------- |
| Database restore             | Monthly       | Restore to test instance, validate data | All tenants/products/events intact     |
| Full stack restore (on-prem) | Quarterly     | Restore from backup on clean VM         | Health checks pass, verification works |
| Region failover (cloud)      | Semi-annually | Failover to DR region                   | RTO met, smoke tests pass              |
| Secret rotation              | Quarterly     | Rotate all secrets                      | No service disruption                  |
| Backup integrity check       | Weekly        | Verify latest backup is restorable      | Backup file valid, not corrupted       |

### Local DR Drill Script

Run monthly against development/staging PostgreSQL:

```bash
export DATABASE_URL=postgresql://truemark:password@localhost:5432/truemark
pnpm dr-drill
```

The script (`scripts/dr-drill-local.sh`) performs backup → restore to scratch DB → integrity SQL checks → cleanup, and reports elapsed RTO.

1. **Announce** drill to stakeholders (unless unannounced drill)
2. **Record** start time
3. **Execute** recovery procedure for chosen scenario
4. **Validate** using post-recovery checklist (below)
5. **Record** end time, calculate actual RTO
6. **Document** issues found and remediation actions
7. **Update** runbook with lessons learned

---

## Post-Recovery Validation Checklist

- [ ] `/health` returns 200
- [ ] `/health/ready` returns 200 (DB + Redis connected)
- [ ] Admin login works (OIDC)
- [ ] Tenant count matches expected
- [ ] Verification domain hostnames resolve correctly
- [ ] Known QR verification returns expected result
- [ ] Latest verification event timestamp is reasonable (within RPO)
- [ ] Tenant → domain → QR relationships intact
- [ ] Audit logs accessible and continuous (no gap during outage)
- [ ] Background worker processing jobs
- [ ] Object storage accessible (upload/download test)
- [ ] Monitoring and alerting restored

---

## Data Integrity Verification

After any database restore, run integrity checks:

```sql
-- Orphaned QR codes (no product unit)
SELECT count(*) FROM qr_codes qr
LEFT JOIN product_units pu ON pu.id = qr.product_unit_id
WHERE pu.id IS NULL;

-- Orphaned verification events (no tenant)
SELECT count(*) FROM verification_events ve
LEFT JOIN tenants t ON t.id = ve.tenant_id
WHERE t.id IS NULL;

-- Credentials without product units
SELECT count(*) FROM verification_credentials vc
LEFT JOIN product_units pu ON pu.id = vc.product_unit_id
WHERE pu.id IS NULL;

-- Duplicate serial numbers within tenant (should be 0)
SELECT tenant_id, serial_number, count(*)
FROM serials
GROUP BY tenant_id, serial_number
HAVING count(*) > 1;

-- Verification events count by day (check for gaps)
SELECT date(created_at), count(*)
FROM verification_events
WHERE created_at > now() - interval '30 days'
GROUP BY date(created_at)
ORDER BY date(created_at);
```

All counts should be zero (except the daily event distribution which should be continuous).

---

## Communication Plan

| Severity                 | Notification                 | Channel                   | Timeframe    |
| ------------------------ | ---------------------------- | ------------------------- | ------------ |
| P1 — Full outage         | All stakeholders + customers | Status page, email, Slack | Immediate    |
| P2 — Partial degradation | Engineering + ops            | Slack, PagerDuty          | 15 minutes   |
| P3 — Non-critical        | Engineering                  | Slack                     | 1 hour       |
| Drill                    | Engineering team             | Slack                     | Before/after |

**Status page template:**

```
[INVESTIGATING] TrueMark verification service is experiencing issues.
Impact: Consumer QR verification unavailable.
Started: 2026-08-22 14:00 UTC
Updates: Every 30 minutes until resolved.
```

---

## Related Documents

- [Cloud Deploy Runbook](./cloud-deploy.md)
- [On-Prem Install Runbook](./onprem-install.md)
- [Production Readiness](../PRODUCTION_READINESS.md)
- [System Architecture](../architecture/SYSTEM.md)
