============================================================
TRUEMARK
ENTERPRISE PRODUCT AUTHENTICATION & ANTI-COUNTERFEIT PLATFORM
MASTER PRODUCT + ARCHITECTURE + IMPLEMENTATION PROMPT
============================================================


============================================================
0. ROLE
============================================================

You are acting as a senior product architect, staff/principal software
engineer, security architect, cloud architect, AI architect, DevOps
engineer, QA engineer, and technical lead.

Your responsibility is to design and incrementally implement a
production-grade enterprise platform called:

TRUE MARK

TrueMark is a digital product identity authentication and
anti-counterfeit platform.

The platform must be designed as a commercial product that can be:

1. Deployed as a SaaS platform for multiple companies.
2. Deployed as a dedicated environment for a specific company.
3. Deployed inside a customer's cloud environment.
4. Deployed fully on-premises.
5. Deployed in hybrid mode.
6. Extended with optional AI-based physical product validation.

Do not treat TrueMark as a single-company application.

TrueMark must be designed as a reusable enterprise product.


============================================================
1. PRIMARY PRODUCT OBJECTIVE
============================================================

The primary objective is to allow a consumer to verify a physical
product without requiring consumer authentication.

The consumer should be able to:

1. Scan a TrueMark QR code.
2. Automatically verify the product.
3. See registered product/manufacturer information.
4. Optionally enter a verification code manually if QR scanning is
   unavailable.
5. Receive a clear verification result.
6. Report a suspicious product without logging in.

The core verification system must be:

FAST
SECURE
MULTI-TENANT
AUDITABLE
CLOUD-READY
ON-PREM READY

AI is an optional additional physical validation layer.

AI must NOT replace the core digital identity verification.


============================================================
2. PRODUCT PRINCIPLES
============================================================

The system must follow these principles:

1. Consumer does not require login.
2. Admin users require authentication.
3. Core verification is digital product identity authentication.
4. Core verification must be fast.
5. Core verification must not require AI.
6. Core verification must not require OCR.
7. Core verification must not require product images.
8. AI is optional.
9. AI may be disabled.
10. AI may be enabled later.
11. AI may be optional or required depending on configuration.
12. AI validates physical product evidence.
13. Digital authentication and physical validation are separate.
14. A valid QR does not automatically prove physical authenticity.
15. A valid serial does not automatically prove physical authenticity.
16. Invalid/revoked/blocked QR cannot become genuine through AI.
17. AI confidence is not proof.
18. Fraud risk and AI confidence are separate concepts.
19. Historical verification evidence must never be destroyed.
20. Every verification event must be auditable.
21. Every AI execution must be auditable.
22. Tenant isolation is mandatory.
23. Production URLs and tenant domains must never be hardcoded.
24. Secrets must never be committed to source control.
25. Internal database IDs must not be exposed publicly.
26. Authentication credentials must be non-guessable.
27. QR enumeration must be prevented.
28. QR cloning must be considered.
29. Serial cloning must be considered.
30. QR + serial copying must be considered.
31. Geographic anomalies must be considered.
32. High-frequency scanning must be considered.
33. Cloud, on-prem, and hybrid deployment must be supported.
34. Infrastructure dependencies must be abstracted where practical.


============================================================
3. COMMERCIAL PRODUCT MODEL
============================================================

TrueMark must be designed as a product that can be onboarded and
deployed for specific clients/companies.

A customer/company is represented as a TENANT.

Example:

TrueMark
|
+-- Company A
|
+-- Company B
|
+-- Company C


Each tenant is independently isolated.

A tenant may represent:

- Manufacturer
- Brand owner
- Distributor
- Enterprise customer
- Product owner
- Customer-specific deployment


Each tenant must have independent:

- Company profile
- Domain configuration
- TrueMark verification domain
- Brands
- Manufacturers
- Products
- Variants
- Batches
- Product units
- Serial numbers
- Verification codes
- QR codes
- AI configuration
- Reference data
- Verification history
- Fraud intelligence
- Analytics
- Investigations
- Admin users
- Roles
- Settings
- Audit records


============================================================
4. DEPLOYMENT MODELS
============================================================

TrueMark must support multiple deployment models.

------------------------------------------------------------
MODEL A — TRUE MARK SAAS
------------------------------------------------------------

TrueMark operates the infrastructure.

Multiple companies can use the same platform.

Example:

Company A
Company B
Company C

All are logically isolated tenants.


------------------------------------------------------------
MODEL B — DEDICATED CUSTOMER CLOUD
------------------------------------------------------------

A specific customer receives a dedicated TrueMark deployment.

The customer may run it in:

- AWS
- Azure
- GCP
- Other compatible cloud environment


Example:

Customer:
ABC Pharmaceuticals

Deployment:

Application
Database
Object storage
Cache
Queue
Monitoring
Secrets

All inside the customer's cloud account/environment.


------------------------------------------------------------
MODEL C — ON-PREM
------------------------------------------------------------

A customer must be able to run TrueMark entirely inside its own
infrastructure.

Possible components:

- Application
- Database
- Object storage
- Cache
- Queue
- AI
- Monitoring
- Logging
- Identity integration
- Secret/key management


Customer data may remain entirely inside the customer's environment.


------------------------------------------------------------
MODEL D — HYBRID
------------------------------------------------------------

Support hybrid deployments.

Examples:

Core application:
On-prem

Database:
On-prem

Product images:
On-prem

AI:
Cloud

OR:

Core:
Cloud

Customer data:
On-prem

AI:
On-prem


The architecture must support configurable hybrid boundaries.


============================================================
5. TENANT ONBOARDING
============================================================

TrueMark must support onboarding a new company/customer.

When a new company is onboarded, the system must create a tenant.

Example:

Company:
ABC Pharmaceuticals

Tenant ID:
Internal non-public identifier

Company domain:
https://www.abcpharma.com

TrueMark verification domain:
https://verify.abcpharma.com


The following tenant configuration must be persisted:

- Company name
- Legal/company information where required
- Primary company domain
- TrueMark verification domain
- Verification path
- Domain status
- Domain verification status
- Deployment type
- Tenant status
- Configuration version
- Created timestamp
- Updated timestamp


Tenant-specific configuration must be stored in the authoritative
database.

Do NOT rely only on environment variables for tenant-specific
configuration.


============================================================
6. COMPANY DOMAIN CONFIGURATION
============================================================

Each tenant must support a company domain.

Example:

https://www.abcpharma.com

This identifies the customer's/company's official domain.

The platform must validate domain values.

Protect against:

- Invalid URLs
- Unsupported protocols
- Malformed domains
- Open redirects
- Domain confusion
- Host-header attacks
- Unauthorized domain changes


Only approved domains may be used.


============================================================
7. TRUE MARK VERIFICATION DOMAIN
============================================================

Each tenant must have a TrueMark verification domain or subdomain.

Example:

Company:

ABC Pharmaceuticals

Company domain:

https://www.abcpharma.com

TrueMark verification domain:

https://verify.abcpharma.com


Another company:

XYZ Electronics

Company domain:

https://www.xyzelectronics.com

TrueMark verification domain:

https://verify.xyzelectronics.com


The verification domain must be associated with the tenant in the
database.

The system must NOT assume that every tenant uses the same domain.


============================================================
8. DOMAIN VERIFICATION DURING QR VERIFICATION
============================================================

This is a mandatory requirement.

When a QR code is scanned, the application must validate the
verification domain.

Example QR:

https://verify.abcpharma.com/v/<secure-token>


The system must:

1. Parse the URL.
2. Validate the protocol.
3. Validate the hostname.
4. Determine the configured tenant/domain.
5. Verify that the hostname belongs to an approved TrueMark
   verification domain.
6. Resolve the tenant.
7. Validate the secure QR credential.
8. Validate QR lifecycle state.
9. Validate product/unit identity.
10. Continue with core verification.


The domain itself must NOT be treated as proof of product authenticity.

Domain validation establishes that the verification request is
associated with an approved TrueMark tenant configuration.

Product authentication must still occur independently.


============================================================
9. DOMAIN SECURITY
============================================================

Protect against:

- Open redirects
- Host-header manipulation
- Domain spoofing
- Domain confusion
- Subdomain confusion
- URL manipulation
- SSRF
- Arbitrary redirect targets
- Untrusted redirect parameters

Do not blindly redirect users based on URL parameters.

Do not allow users to supply arbitrary verification domains.

Do not expose internal service URLs.

Only configured/approved tenant verification domains may participate
in the verification flow.


============================================================
10. DOMAIN CONFIGURATION LIFECYCLE
============================================================

Support domain lifecycle states such as:

PENDING
ACTIVE
SUSPENDED
REVOKED
DISABLED

Domain changes must be auditable.

Historical verification records must preserve the domain/configuration
context that existed when the verification occurred.

A tenant domain change must not corrupt historical evidence.


============================================================
11. ADMIN APPLICATION
============================================================

The Admin application requires authentication.

Support enterprise authentication.

Preferred authentication may include:

- Auth0
- OIDC
- OAuth 2.0
- SAML where appropriate
- Customer identity provider for enterprise/on-prem deployments

Do not hardcode a single identity provider into business logic.

Support:

- MFA
- RBAC
- Least privilege
- Session security
- Token validation
- Audit logging


============================================================
12. ADMIN SIDEBAR
============================================================

The admin sidebar should support at minimum:

Dashboard

Organizations / Clients

Manufacturers

Brands

Products

Variants

Batches

Product Units

Serial Numbers

QR Codes

QR Code Customization

Verification History

AI Detection

Fraud Intelligence

Investigations

Reports

Analytics

Notifications

Audit Logs

Domain Configuration

Deployment Configuration

Settings


The exact UI may be improved by the implementation agent.


============================================================
13. QR CODE CUSTOMIZATION
============================================================

A dedicated:

QR CODE CUSTOMIZATION

section MUST exist in the Admin panel.

It must not be hidden under unrelated settings.


The administrator should be able to configure QR presentation.

Support configurable:

1. QR size
2. Width
3. Height
4. Error correction level
5. Foreground
6. Background
7. Logo
8. Brand logo
9. Quiet zone
10. Border
11. QR module style where supported
12. Output format
13. Print dimensions
14. DPI where relevant
15. Label dimensions
16. QR placement
17. Text above QR
18. Text below QR
19. Product code display
20. Serial display
21. Security instructions
22. Scratch-area configuration where applicable


Output formats may include:

- PNG
- SVG
- PDF

The implementation must choose appropriate libraries based on current
official documentation.


============================================================
14. QR CUSTOMIZATION SECURITY RULE
============================================================

Visual customization must never alter the authentication identity.

The following must remain logically independent:

QR visual appearance

AND

Secure authentication credential.


Changing:

- Logo
- Color
- Size
- Border
- Print layout
- Text

must NOT change the underlying product identity unless a new QR
credential is intentionally generated.


All QR configuration changes must be auditable.


============================================================
15. PRODUCT MODEL
============================================================

Do not confuse:

PRODUCT DEFINITION

with:

PHYSICAL PRODUCT UNIT.


Example:

Product:

ABC Shampoo 500ml


Physical units:

Unit 000001
Unit 000002
Unit 000003
...
Unit 100000


Each physical product unit may have its own:

- Product identity
- Batch
- Serial
- Verification code
- QR
- Lifecycle
- Verification history


============================================================
16. PRODUCT MANAGEMENT
============================================================

Admins must be able to manage:

- Manufacturer
- Brand
- Product
- Variant
- Batch
- Product unit
- Serial
- QR
- Product metadata
- Lifecycle
- Reference data
- Security features
- AI configuration
- Verification settings
- Fraud settings


Do not design the platform for only one product category.


============================================================
17. FLEXIBLE PRODUCT DATA
============================================================

Support configurable product-specific data.

Examples:


Pharmaceutical:

- Batch
- Manufacturing date
- Expiry
- License
- Composition
- Regulatory information


Electronics:

- Model
- Serial
- IMEI
- MAC
- Manufacturing date
- Warranty


Automotive:

- VIN
- Part number
- Batch
- Certification


Consumer goods:

- Batch
- MRP
- Manufacturing date
- Expiry
- Regulatory information


The architecture must allow additional product-specific attributes
without redesigning the core authentication architecture.


============================================================
18. PRODUCT CREATION → UNIQUE IDENTITY
============================================================

When an administrator creates physical product units, the system must
generate unique authentication identities.

For each physical product unit, generate:

1. Unique serial number.
2. Unique secure verification code/token.
3. Unique QR credential.
4. Association to tenant.
5. Association to manufacturer.
6. Association to brand.
7. Association to product.
8. Association to variant where applicable.
9. Association to batch where applicable.
10. Lifecycle state.


The generated identifiers must be cryptographically/non-predictably
secure where they act as authentication credentials.


============================================================
19. PRODUCT UNIT GENERATION
============================================================

Support both:

SINGLE UNIT GENERATION

and:

BULK UNIT GENERATION.


Example:

Admin creates:

ABC Shampoo 500ml

Batch:

BATCH-2026-08

Quantity:

10,000


The system generates:

10,000 unique product units

10,000 unique serials

10,000 unique verification credentials

10,000 unique QR codes


The operation must be safe for large batches.

Do not generate massive datasets through inefficient sequential
database operations.

Design appropriate bulk-generation mechanisms.


============================================================
20. SERIAL NUMBER
============================================================

A serial number identifies the physical product unit.

Example:

SN-ABC-2026-000001


Serial numbers may be visible to the consumer where appropriate.

However:

A serial number must NOT automatically be treated as a secure
authentication credential.

Do not use predictable sequential serials as authentication secrets.


============================================================
21. SECURE VERIFICATION CODE
============================================================

Each physical product unit must have a secure verification credential.

Example:

TM-X8P7-K92M-Q4Z6


The credential must be:

- Unique
- Non-guessable
- Sufficiently high entropy
- Rate-limited
- Protected from enumeration
- Associated with exactly the intended product identity


Do not expose internal database IDs.


============================================================
22. QR GENERATION
============================================================

Every generated physical product unit must have a QR code.

The QR must encode a secure verification URL or equivalent secure
credential.

Example:

https://verify.abcpharma.com/v/<secure-token>


The QR must NOT expose:

- Internal database IDs
- Database primary keys
- Secrets
- Infrastructure information
- Tenant database identifiers
- Sensitive customer information


The QR must resolve through the tenant's configured TrueMark
verification domain.


============================================================
23. QR + PRODUCT ASSOCIATION
============================================================

Each QR must be associated with:

- Tenant
- Manufacturer
- Brand
- Product
- Variant
- Batch
- Product unit
- Serial
- Secure verification credential
- QR lifecycle
- QR configuration version
- Creation timestamp


This relationship must be auditable.


============================================================
24. MANUAL VERIFICATION CODE ENTRY
============================================================

The consumer must have two verification methods.

METHOD 1:

SCAN QR


METHOD 2:

ENTER VERIFICATION CODE MANUALLY


Consumer UI example:

-----------------------------------------
TRUE MARK
-----------------------------------------

Scan the QR code to verify your product.

[ SCAN QR ]

OR

Enter verification code:

[________________________]

[ VERIFY ]

-----------------------------------------


Manual verification must use the same Core Verification service as QR
verification.

Do NOT create a separate authentication implementation for manual code
verification.


============================================================
25. QR AND MANUAL CODE FLOW
============================================================

QR flow:

QR
↓
Verification URL
↓
Domain validation
↓
Tenant resolution
↓
Secure credential validation
↓
Product identity validation
↓
Core verification
↓
Result


Manual code flow:

Manual code
↓
Secure credential validation
↓
Product identity validation
↓
Core verification
↓
Result


Both flows must converge into the same authoritative verification
service.


============================================================
26. CORE VERIFICATION
============================================================

Core verification must validate:

1. Verification domain.
2. Tenant.
3. QR/code credential.
4. Credential lifecycle.
5. Product unit.
6. Serial where applicable.
7. Product lifecycle.
8. Batch lifecycle where applicable.
9. Recall state.
10. Expiry where applicable.
11. Historical verification context.
12. Reuse behavior.
13. Fraud signals.
14. Clone signals.


Core verification must NOT automatically run AI.


============================================================
27. CORE VERIFICATION RESULT STATES
============================================================

Possible states include:

VERIFIED

REVERIFIED

SUSPICIOUS

POSSIBLE_CLONE

POSSIBLE_COUNTERFEIT

CONFIRMED_COUNTERFEIT

INVALID_QR

UNKNOWN_QR

REVOKED_QR

BLOCKED_QR

EXPIRED

RECALLED

SUSPENDED

UNABLE_TO_VERIFY


Use appropriate business semantics.

Do not incorrectly label:

EXPIRED

as:

COUNTERFEIT.


Do not incorrectly label:

RECALLED

as:

COUNTERFEIT.


============================================================
28. NORMAL REVERIFICATION
============================================================

A second scan MUST NOT automatically mean counterfeit.

Example:

Scan #1:

Bangalore
10:00 AM


Scan #2:

Bangalore
10:30 AM


Expected:

REVERIFIED


Another example:

Scan #1:
Bangalore
10:00

Scan #2:
Bangalore
11:00

Scan #3:
Bangalore
18:00


Expected:

REVERIFIED

Risk:

LOW


Do not create simplistic rules such as:

"Scanned twice = counterfeit."


============================================================
29. REPEATED SCAN ANALYSIS
============================================================

Every verification should consider historical context.

Potential signals:

- First verification
- Previous verification count
- Time since previous verification
- Scan frequency
- Geographic consistency
- Geographic anomaly
- Impossible travel
- QR reuse
- Serial reuse
- Batch activity
- Product activity
- Historical risk
- Previous fraud reports


============================================================
30. HIGH-FREQUENCY SCANNING
============================================================

Example:

Same QR

50 scans

within 30 minutes


Generate a signal:

HIGH_SCAN_FREQUENCY


Potential result:

SUSPICIOUS_ACTIVITY


Do not automatically declare counterfeit.

The final result must consider other evidence.


============================================================
31. GEOGRAPHIC ANOMALY
============================================================

Example:

10:00
Bangalore

10:05
Hyderabad

10:15
Delhi


If the same product identity appears in physically impossible
locations within a short time, generate:

GEOGRAPHIC_ANOMALY

and/or:

IMPOSSIBLE_TRAVEL


Potential result:

POSSIBLE_CLONE


Do not rely on geographic information alone to make a definitive
counterfeit claim.


============================================================
32. QR CLONING
============================================================

Consider the threat where a genuine QR is copied onto counterfeit
packaging.

The system must detect signals such as:

- Excessive QR reuse
- Unexpected locations
- Impossible travel
- Abnormal scan frequency
- Different distribution patterns
- Batch anomalies
- Serial reuse


A valid QR does not guarantee physical authenticity.


============================================================
33. SERIAL CLONING
============================================================

Consider the possibility that a genuine serial number is copied onto
counterfeit products.

A valid serial does not automatically prove physical authenticity.


============================================================
34. QR + SERIAL CLONING
============================================================

A counterfeiter may copy:

- QR
- Serial
- Product information
- Packaging information


Therefore:

VALID QR + VALID SERIAL

does NOT automatically guarantee:

GENUINE PHYSICAL PRODUCT.


This is one of the primary reasons TrueMark AI exists.


============================================================
35. AI ROLE
============================================================

AI is an optional physical validation layer.

AI may:

- Analyze product images.
- Analyze packaging.
- Perform OCR.
- Extract product information.
- Compare physical appearance.
- Compare reference images.
- Analyze logos.
- Analyze security seals.
- Analyze holograms.
- Analyze labels.
- Compare expected attributes.
- Produce confidence.
- Produce physical mismatch signals.


AI must NOT:

- Override QR cryptographic validation.
- Unblock a QR.
- Change authoritative product data.
- Override revocation.
- Override blocking.
- Change tenant configuration.
- Access another tenant.
- Modify fraud rules.
- Make legally definitive counterfeit claims by itself.


============================================================
36. AI ENABLE / DISABLE
============================================================

AI Detection must be configurable by administrators.

Support:

AI_ENABLED

AI_DISABLED

AI_OPTIONAL

AI_REQUIRED


Configuration may apply at:

- Organization
- Brand
- Product
- Variant


Use appropriate inheritance and override behavior.


============================================================
37. AI DISABLED
============================================================

When AI is disabled:

DO NOT:

- Request images
- Open camera
- Perform OCR
- Run AI
- Upload images for AI
- Calculate AI confidence
- Calculate AI physical fraud signals


Core verification must continue normally.


Consumer UI may show:

"Additional physical AI validation is not enabled for this product."


Do not make AI appear broken.

It is intentionally disabled.


============================================================
38. AI ENABLED
============================================================

When AI is enabled after Core verification:

Show:

"Additional physical product validation is available."


Button:

[ VALIDATE USING AI ]


If AI is optional:

Consumer may continue without AI.


If AI is required:

Consumer must complete the configured AI workflow before the final
verification result is presented, subject to system/business rules.


============================================================
39. IMAGE VALIDATION
============================================================

If AI requires images, validate image quality before expensive AI
processing.

Poor images must result in:

IMAGE_NOT_CLEAR

or equivalent state.


Example:

"Image is not clear enough. Please retake or upload a clearer image."


Do not blindly process poor-quality images.


============================================================
40. MULTI-ANGLE IMAGE SUPPORT
============================================================

Support:

- Front
- Back
- Left
- Right
- Top
- Bottom
- Additional images


Each view may be:

- Required
- Optional


The configuration must determine which views are required.


============================================================
41. AI OCR
============================================================

Where enabled, AI/OCR may extract:

- Batch
- Manufacturing date
- Expiry
- Serial
- Product code
- Regulatory identifiers
- Other configured product attributes


Extracted values must be compared against authoritative registered
product data.


Every mismatch must be recorded individually.


============================================================
42. AI REFERENCE DATA
============================================================

Authorized administrators must be able to maintain reference data.

Potential reference data:

- Product images
- Packaging images
- Logo
- Security seal
- Hologram
- Labels
- Security features
- Expected text
- Expected attributes
- Manufacturer-defined evidence


Reference data must be versioned.


Historical AI results must retain the reference version used.


============================================================
43. AI MODEL VERSIONING
============================================================

Every AI analysis must preserve enough information for auditability.

Capture where applicable:

- Provider
- Model
- Model version
- Configuration version
- Reference dataset version
- Prompt/configuration version where relevant
- Timestamp
- Processing status
- AI result
- AI confidence
- Input/evidence references


Do not silently change historical interpretation.


============================================================
44. AI CONFIDENCE
============================================================

AI confidence is probabilistic evidence.

AI confidence is NOT proof.

Do not present AI confidence as legal certainty.

Do not claim:

"100% Genuine"

unless the business/legal requirements explicitly support such a
statement.


============================================================
45. FRAUD INTELLIGENCE
============================================================

The platform must support fraud intelligence.

Signals may include:

- QR reuse
- Serial reuse
- High-frequency scanning
- Geographic anomaly
- Impossible travel
- Batch anomalies
- Product anomalies
- Previous fraud reports
- AI physical mismatch
- Packaging mismatch
- Security feature mismatch


Where a score is used, retain:

- Score
- Risk level
- Signals
- Evidence
- Rule/model version


Do not produce unexplained numbers.


============================================================
46. FRAUD INVESTIGATION
============================================================

Authorized administrators can investigate:

- Product
- Brand
- Manufacturer
- Batch
- Serial
- QR
- Verification history
- Locations
- AI results
- Images
- OCR
- Fraud signals
- Consumer reports
- Previous investigations


Investigation states may include:

OPEN

UNDER_REVIEW

FALSE_POSITIVE

CONFIRMED_COUNTERFEIT

RESOLVED


All changes must be auditable.


============================================================
47. CONFIRMED COUNTERFEIT
============================================================

Do not allow an AI model alone to make a legally definitive
counterfeit determination unless business/legal requirements
explicitly authorize it.


Use:

POSSIBLE_COUNTERFEIT

for automated evidence.


Authorized human investigators may mark:

CONFIRMED_COUNTERFEIT

after reviewing evidence.


============================================================
48. PRODUCT LIFECYCLE
============================================================

Support appropriate lifecycle states:

DRAFT

ACTIVE

INACTIVE

DISCONTINUED

RECALLED

BLOCKED

RETIRED


Do not destroy historical verification evidence when lifecycle changes.


============================================================
49. BATCH / SERIAL / QR LIFECYCLE
============================================================

Support appropriate states such as:

REGISTERED

ACTIVE

SUSPENDED

BLOCKED

REVOKED

RECALLED

RETIRED


Use the correct state for each business context.


============================================================
50. RECALL
============================================================

The platform must support product and batch recalls.

If a product/batch is recalled, the consumer should receive an
appropriate message.

Example:

"⚠ This product/batch has been recalled by the manufacturer."


Do not incorrectly label a recalled product as counterfeit.


============================================================
51. EXPIRY
============================================================

Where applicable, support product expiry.

Important distinction:

EXPIRED

is not automatically:

COUNTERFEIT.


Consumer result must distinguish these states.


============================================================
52. CONSUMER REPORTING
============================================================

Consumers must be able to report suspicious products without login.

Possible information:

- Verification ID
- Product
- QR reference
- Reason
- Comment
- Optional image
- Timestamp
- Approximate area where appropriate


Protect reporting APIs against:

- Spam
- Bots
- Abuse
- Malicious uploads
- Resource exhaustion


============================================================
53. LOCATION
============================================================

Capture location only where legally permitted and technically
available.

Potential data:

- Country
- State
- Region
- District
- City
- Area
- Approximate coordinates
- Location source
- Timestamp


Possible sources:

- GPS
- IP approximation
- Network
- Manual
- Unknown


Do not unnecessarily expose precise consumer coordinates.

Use aggregation for public/admin analytics where appropriate.


============================================================
54. MULTI-TENANCY
============================================================

Support multiple organizations.

Tenant isolation is mandatory.


Company A must NEVER access Company B's:

- Products
- Brands
- Manufacturers
- Batches
- Product units
- Serials
- Verification codes
- QRs
- Images
- AI reference data
- Verification data
- Fraud investigations
- Analytics
- Audit data


Authorization must be enforced server-side.

Never trust tenant IDs directly from browser input.


============================================================
55. TENANT-SCOPED CONFIGURATION
============================================================

Tenant-specific configuration may include:

- Company domain
- TrueMark verification domain
- QR configuration
- Product settings
- AI configuration
- AI quotas
- Fraud settings
- Verification rules
- Branding
- Consumer messaging
- Retention
- Storage
- Deployment settings where applicable


Tenant configuration must be isolated and auditable.


============================================================
56. ADMIN DASHBOARD
============================================================

Dashboard should provide insights including:

- Total verifications
- First verifications
- Repeat verifications
- Verified
- Reverified
- Suspicious
- Possible Clone
- Possible Counterfeit
- Confirmed Counterfeit
- Invalid QR
- Unknown QR
- Revoked QR
- Blocked QR
- Expired
- Recalled
- AI validations
- AI failures
- AI high-risk results
- Average AI confidence
- Clone risk
- Physical risk
- Top products
- Top batches
- Top brands
- Top manufacturers
- Top locations
- Clone alerts
- Fraud investigations


============================================================
57. ADMIN ANALYTICS
============================================================

Capture enough data to answer:

How many products were verified?

How many unique product identities were verified?

How many repeat scans occurred?

How many were suspicious?

How many possible clones?

How many possible counterfeits?

How many confirmed counterfeits?

Which products have the highest fraud rate?

Which batches have abnormal behavior?

Which locations have the highest fraud rate?

Which brands are most affected?

How frequently is AI used?

Which AI checks fail most frequently?

What are common physical mismatches?

What is AI usage/cost?

What are investigation outcomes?


Do not fabricate analytics.


============================================================
58. ADMIN FILTERS
============================================================

Allow filtering by:

- Date
- Organization
- Manufacturer
- Brand
- Product
- Variant
- Batch
- Product unit
- Serial
- Location
- Result
- AI status
- Risk level
- QR status
- Domain
- Deployment


============================================================
59. PRODUCT FRAUD INSIGHTS
============================================================

Admin should be able to identify:

- Products with highest suspicious rate
- Products with highest counterfeit rate
- Batches with unusual reuse
- QRs with unusual activity
- Serials with unusual activity
- Areas with unusual counterfeit activity
- Products with repeated physical AI mismatches
- Frequently occurring AI signals


============================================================
60. IMAGE STORAGE
============================================================

Do not store large image binaries directly in relational databases.

Use appropriate object storage.

Support:

Cloud object storage

S3-compatible storage

On-prem object storage


Examples may include:

Cloud:

AWS S3

Azure Blob Storage

Google Cloud Storage


On-prem:

S3-compatible object storage

MinIO

Enterprise storage


The implementation must choose appropriate technology based on
deployment requirements.


Capture:

- Metadata
- Secure object reference
- Encryption information
- Retention
- Version where applicable


Use short-lived access URLs where appropriate.


============================================================
61. MULTI-TENANT STORAGE
============================================================

Object storage must enforce tenant isolation.

Example:

tenant-a/
    products/
    reference-data/
    verification-evidence/

tenant-b/
    products/
    reference-data/
    verification-evidence/


Never allow one tenant to access another tenant's objects.


============================================================
62. CLOUD + ON-PREM STORAGE ABSTRACTION
============================================================

Do not tightly couple business logic to one storage provider.

Create an abstraction for object storage.

Example conceptual interface:

ObjectStorageProvider

Methods may include:

upload
download
delete
getMetadata
createSignedUrl


Implementations may include:

CloudObjectStorageProvider

S3CompatibleStorageProvider

OnPremObjectStorageProvider


The final implementation must be determined after architecture review.


============================================================
63. SECRETS AND KEY MANAGEMENT
============================================================

Never commit secrets.

Never store production secrets in source control.

Never expose secrets to consumers.

Never log secrets.

Never include secrets in audit records.


------------------------------------------------------------
CLOUD
------------------------------------------------------------

Support cloud secret/key-management services.

Examples:

AWS Secrets Manager / KMS

Azure Key Vault

Google Secret Manager / KMS


------------------------------------------------------------
ON-PREM
------------------------------------------------------------

Support enterprise/on-prem secret management.

Possible approaches:

HashiCorp Vault

Kubernetes Secrets with appropriate encryption/key management

Customer enterprise key management

Other approved secret-management systems


Development may use:

.env


Production must NOT depend on plaintext .env files when a secure
secret-management mechanism is available and required by the
deployment.


============================================================
64. ENCRYPTION
============================================================

Protect sensitive data in transit and at rest.

Use:

TLS

Encryption at rest

Secure key management

Key rotation where appropriate


Authentication credentials and verification tokens must use the
appropriate protection mechanism.

Do not simply encrypt everything blindly.

Determine whether data requires:

- Hashing
- Encryption
- Tokenization
- Digital signatures
- Non-guessable identifiers


based on how the value is used.


============================================================
65. QR SECURITY
============================================================

Protect against:

- QR enumeration
- Token guessing
- QR replay
- QR cloning
- QR manipulation
- URL manipulation
- Bot scanning
- Brute force
- Scraping


QR credentials must be sufficiently unpredictable.

Do not use sequential IDs as authentication credentials.


============================================================
66. PUBLIC VERIFICATION API
============================================================

The QR verification API is public and must be treated as a
high-risk/untrusted entry point.


Protect against:

- Enumeration
- Brute force
- Token guessing
- Automation
- Replay
- Scraping
- Resource exhaustion
- Abuse


Do not expose enough information to allow attackers to enumerate the
entire product database.


============================================================
67. RATE LIMITING
============================================================

Apply appropriate rate limits to:

- QR verification
- Manual code verification
- Barcode verification
- AI initiation
- Image upload
- Consumer reporting


AI endpoints require stricter controls because they can be expensive.


============================================================
68. API DESIGN
============================================================

Use secure REST APIs unless research justifies another approach.

Separate:

PUBLIC VERIFICATION APIs

from:

AUTHENTICATED ADMIN APIs


Use:

- API versioning
- Input validation
- Pagination
- Filtering
- Rate limiting
- Idempotency where appropriate
- Correlation IDs
- Consistent error handling
- Secure defaults


Document APIs using OpenAPI/Swagger.


============================================================
69. ERROR HANDLING
============================================================

Consumer responses must be simple.

Never expose:

- Stack traces
- Database errors
- Internal IDs
- Infrastructure details
- Secrets
- Internal fraud rules


Use correlation IDs for troubleshooting.


============================================================
70. PRIVACY
============================================================

Consumer verification is anonymous.

Collect only necessary data.

Protect:

- Location
- Device/network information
- Images
- Product information
- Fraud evidence


Do not publicly expose precise consumer locations.

Support configurable retention.


============================================================
71. AUDIT LOGGING
============================================================

Capture administrative and security-sensitive events.

Examples:

Admin login
Admin logout
Product created
Product changed
Product archived
Batch created
Product unit created
Serial created
Verification code generated
QR generated
QR activated
QR revoked
QR blocked
QR customization changed
Tenant created
Tenant domain changed
Verification domain changed
AI enabled
AI disabled
AI configuration changed
Reference image changed
Fraud investigation created
Fraud status changed
Counterfeit confirmed
User/role changed
Configuration changed
Export created


Audit records must not contain secrets.


============================================================
72. OBSERVABILITY
============================================================

Implement:

- Structured logging
- Metrics
- Distributed tracing where appropriate
- Health checks
- Readiness
- Liveness
- Alerts


Monitor:

- Core latency
- Core failure rate
- Invalid QR rate
- Invalid manual-code rate
- QR reuse
- Clone alerts
- AI usage
- AI latency
- AI failure
- OCR failure
- Image rejection
- Fraud rate
- Database performance
- Queue depth
- Storage failures
- Authentication failures
- Domain verification failures


============================================================
73. PERFORMANCE
============================================================

Core verification must be significantly faster than AI validation.

Never run expensive AI/OCR operations as part of the Core QR path.

AI processing may be asynchronous where appropriate.

Define realistic SLOs based on architecture and deployment.


============================================================
74. CLOUD + ON-PREM CONFIGURATION
============================================================

All deployment-level values must be configurable.

Examples:

- Database
- Object storage
- Authentication
- AI provider
- AI endpoint
- Verification defaults
- Feature flags
- Limits
- Encryption
- Logging
- Monitoring
- Secret management


Tenant-specific domains must be stored in the database.

Do not hardcode production URLs.


============================================================
75. FEATURE FLAGS
============================================================

Support secure feature flags.

Examples:

AI_ENABLED

AI_FOR_VALID_QR

AI_FOR_INVALID_QR

AI_FOR_SUSPICIOUS_QR

CONSUMER_REPORTING_ENABLED

MANUAL_CODE_VERIFICATION_ENABLED

QR_CUSTOMIZATION_ENABLED


Do not allow consumers to enable restricted features through browser
requests.


============================================================
76. AI GOVERNANCE
============================================================

Maintain:

- Model/version information
- Configuration/version
- Reference data version
- Evaluation information
- Confidence
- Evidence
- Known limitations
- Failure states
- Human review capability


AI must be explainable at the level required for the product.

Do not claim absolute certainty.


============================================================
77. NO FABRICATED RESULTS
============================================================

Never fabricate:

- AI confidence
- OCR
- Fraud score
- Analytics
- Product data
- Verification results


If AI is not configured:

AI_NOT_CONFIGURED


If AI is temporarily unavailable:

AI_UNAVAILABLE


Do not pretend AI has executed.


Mocks are permitted only for development/testing and must be clearly
separated from production.


============================================================
78. NO HARDCODED BUSINESS DATA
============================================================

Do not hardcode:

- Products
- Brands
- Manufacturers
- Batches
- Product units
- Serials
- Verification codes
- QR codes
- Fraud counts
- AI results
- Production URLs
- Tenant domains
- Credentials
- Secrets


Seed data may be used for development only.


============================================================
79. HISTORICAL VERSIONING
============================================================

Historical verification results must remain explainable.

If the manufacturer changes:

- Product data
- Batch
- Reference images
- AI settings
- Security features
- Fraud rules
- Domain configuration
- QR configuration


historical results must remain associated with the correct historical
context/version.


============================================================
80. DATA MODEL PRINCIPLE
============================================================

Do NOT prescribe a fixed database schema.

The implementation agent must determine the appropriate production
data model.

However, the system MUST capture all information necessary for:

- Tenant
- Organization
- Company domain
- Verification domain
- Domain status
- Manufacturer
- Brand
- Product
- Variant
- Batch
- Product unit
- Serial
- Verification credential
- QR
- QR lifecycle
- QR configuration
- Product lifecycle
- Verification
- Verification history
- Repeated scans
- Location
- AI configuration
- AI usage
- Images
- Image quality
- OCR
- Extracted values
- Reference images
- Security features
- AI results
- AI confidence
- Fraud signals
- Clone signals
- Fraud scores
- Investigations
- Reports
- Notifications
- Analytics
- Audit
- Compliance
- Versioning
- Evidence


Use enterprise-standard modeling.

Do not create a minimal schema that prevents future functionality.


============================================================
81. DATA RELATIONSHIP PRINCIPLE
============================================================

The logical relationship should support:

Tenant
|
+-- Manufacturer
|
+-- Brand
|
+-- Product
|     |
|     +-- Variant
|           |
|           +-- Batch
|                 |
|                 +-- Product Unit
|                       |
|                       +-- Serial
|                       +-- Verification Credential
|                       +-- QR
|                       +-- Verification History
|
+-- Domain Configuration
|
+-- QR Configuration
|
+-- AI Configuration
|
+-- Fraud Configuration


The exact schema is left to the implementation agent.


============================================================
82. PROJECT STRUCTURE PRINCIPLE
============================================================

Do not prescribe an exact folder structure.

Choose an appropriate production-grade architecture.

Maintain clear boundaries between:

- Core verification
- AI processing
- Fraud intelligence
- Admin
- Consumer
- Analytics
- Tenant management
- Domain management
- QR generation
- Shared platform capabilities
- Infrastructure


Avoid unnecessary complexity.


============================================================
83. ARCHITECTURE
============================================================

The implementation agent must produce an architecture before writing
the entire codebase.

At minimum consider:

Frontend

Admin UI

Consumer verification UI

Backend/API

Core verification service

Tenant management

Domain configuration

Product management

QR generation

Verification credential management

AI orchestration

Fraud intelligence

Analytics

Object storage

Database

Cache

Queue

Authentication

Secrets

Monitoring

Audit


The final architecture must be justified.


============================================================
84. CORE VS AI BOUNDARY
============================================================

CORE:

- Domain validation
- Tenant resolution
- QR validation
- Manual code validation
- Credential validation
- Product identity
- Serial validation
- Product lifecycle
- Batch lifecycle
- Verification history
- Repeat validation
- Clone signals
- Basic fraud signals


AI:

- Image quality
- OCR
- Physical appearance
- Packaging
- Logo
- Security features
- Reference comparison
- Physical mismatch
- AI confidence


Do not mix these boundaries unnecessarily.


============================================================
85. SECURITY THREAT MODEL
============================================================

Create a formal threat model.

At minimum consider:

- QR cloning
- QR replay
- QR enumeration
- Serial cloning
- Verification-code guessing
- Fake verification portal
- Phishing
- Open redirect
- URL manipulation
- API abuse
- Bot scanning
- Image attacks
- AI manipulation
- Prompt injection where applicable
- Tenant escape
- Admin compromise
- Data leakage
- Location privacy
- Insider threats
- Key compromise
- Reference-data tampering
- Domain spoofing
- Host-header attacks
- SSRF
- Secret leakage


For each threat identify:

Threat

Impact

Likelihood

Mitigation

Residual risk


============================================================
86. TENANT SECURITY
============================================================

Tenant isolation must be enforced server-side.

Never trust:

tenantId

organizationId

companyId

from browser input.


The authenticated identity and server-side authorization context must
determine which tenant data the user may access.


Every tenant-scoped query must enforce tenant isolation.


============================================================
87. ADMIN AUTHORIZATION
============================================================

Support RBAC and least privilege.

Potential roles:

Platform Administrator

Tenant Administrator

Manufacturer Administrator

Product Manager

Security/Fraud Investigator

Analyst

Read Only


The exact role model must be determined by the architecture.


============================================================
88. CONSUMER EXPERIENCE
============================================================

Consumer should not need to create an account.

Primary flow:

Scan QR

↓

Open TrueMark verification page

↓

Domain validated

↓

Product verified

↓

Result displayed


Alternative:

Open TrueMark verification page

↓

Enter verification code

↓

Verify

↓

Result displayed


Keep the consumer experience simple.


============================================================
89. CONSUMER RESULT
============================================================

Consumer result must clearly communicate status.

Example:

-----------------------------------------
✓ PRODUCT VERIFIED

Product:
ABC Shampoo 500ml

Brand:
ABC Pharma

Manufacturer:
ABC Pharmaceuticals

Batch:
BATCH-2026-08

Status:
Verified

This product is registered with TrueMark.
-----------------------------------------


For suspicious:

-----------------------------------------
⚠ SUSPICIOUS ACTIVITY

This product identity has unusual verification activity.

Please verify the physical product and contact the manufacturer
if necessary.
-----------------------------------------


For invalid:

-----------------------------------------
✕ UNABLE TO VERIFY

This QR/code could not be verified.

Please check that you are using the official TrueMark verification
page.
-----------------------------------------


Do not expose internal fraud rules.


============================================================
90. CRITICAL ACCEPTANCE TEST 1
============================================================

Create tenant:

ABC Pharmaceuticals

Company domain:

https://www.abcpharma.com

Verification domain:

https://verify.abcpharma.com


Create product.

Generate product unit.

Generate serial.

Generate verification credential.

Generate QR.


Scan QR.


Expected:

Correct verification domain

Correct tenant

Valid QR

Valid credential

Valid product

Successful Core verification.


============================================================
91. CRITICAL ACCEPTANCE TEST 2
============================================================

Create two tenants.

Company A:

verify.company-a.com


Company B:

verify.company-b.com


Generate product for Company A.


Attempt verification through Company B's domain or tenant context.


Expected:

Verification must not cross tenant boundaries.


============================================================
92. CRITICAL ACCEPTANCE TEST 3
============================================================

Generate product unit:

Serial:

SN-000001


Verification credential:

TM-X8P7-K92M-Q4Z6


QR:

https://verify.company.com/v/<secure-token>


Scan QR.


Expected:

Consumer does NOT need to type the credential.


The QR automatically supplies the verification credential.


============================================================
93. CRITICAL ACCEPTANCE TEST 4
============================================================

Open consumer verification page without scanning QR.


Enter:

TM-X8P7-K92M-Q4Z6


Expected:

Same Core verification service is used.

Product is verified.


============================================================
94. CRITICAL ACCEPTANCE TEST 5
============================================================

Generate 10,000 product units.


Expected:

10,000 unique serials.

10,000 unique verification credentials.

10,000 unique QR credentials.

No duplicates.

No predictable authentication credentials.

All records correctly associated with the same tenant/product/batch.


============================================================
95. CRITICAL ACCEPTANCE TEST 6
============================================================

Valid QR.

Valid serial.

Second scan.

Same/nearby area.

Reasonable interval.


Expected:

REVERIFIED

NOT COUNTERFEIT


============================================================
96. CRITICAL ACCEPTANCE TEST 7
============================================================

Valid QR.

Valid serial.

Same identity appears in:

Bangalore
10:00

Hyderabad
10:05

Delhi
10:15


Expected:

SUSPICIOUS / POSSIBLE_CLONE

depending on configured risk.


============================================================
97. CRITICAL ACCEPTANCE TEST 8
============================================================

Valid QR.

High clone risk.

AI packaging looks genuine.


Expected:

Do NOT erase clone risk.

Possible final:

POSSIBLE_CLONE


============================================================
98. CRITICAL ACCEPTANCE TEST 9
============================================================

AI enabled.

User uploads blurry image.


Expected:

AI does not continue blindly.

System says:

"Image is not clear enough."


User is asked to retake/upload.


============================================================
99. CRITICAL ACCEPTANCE TEST 10
============================================================

AI enabled.

User provides:

Front

Back

Left

Right

Top

Bottom


AI extracts:

Batch

Manufacturing

Expiry


System compares all against authoritative registered data.


All mismatches must be captured individually.


============================================================
100. CRITICAL ACCEPTANCE TEST 11
============================================================

Configure:

Company A

Company domain:

https://company-a.com

Verification domain:

https://verify.company-a.com


Generate QR.


Expected QR uses:

https://verify.company-a.com/...


NOT:

https://verify.truemark.com/...


unless the architecture explicitly supports that as the configured
tenant model.


============================================================
101. CRITICAL ACCEPTANCE TEST 12
============================================================

Change Company A's verification domain.

Old:

verify.company-a.com


New:

verify.products.company-a.com


Expected:

New QR generations use the new configured domain.

Historical verification records retain their historical configuration.

Existing QR behavior must follow a deliberate lifecycle/versioning
policy.

Do not silently invalidate historical evidence.


============================================================
102. CRITICAL ACCEPTANCE TEST 13
============================================================

QR points to:

https://fake-company.com/v/abc


Expected:

Do not treat the URL as an approved TrueMark verification domain.

Return an appropriate untrusted/invalid verification response.


============================================================
103. CRITICAL ACCEPTANCE TEST 14
============================================================

Admin opens:

QR Code Customization


Expected controls include:

- Size
- Width
- Height
- Error correction
- Logo
- Foreground
- Background
- Quiet zone
- Border
- Output format
- Print dimensions
- Label settings
- Preview


Save configuration.


Generate QR.


Expected:

QR uses the configured visual design while retaining the correct
authentication credential.


============================================================
104. CRITICAL ACCEPTANCE TEST 15
============================================================

AI disabled.


Scan valid QR.


Expected:

Core verification succeeds.

No:

- Camera
- Image upload
- OCR
- AI request
- AI confidence


============================================================
105. CRITICAL ACCEPTANCE TEST 16
============================================================

AI provider not configured.


Attempt AI validation.


Expected:

AI_NOT_CONFIGURED


Do not fabricate AI results.


============================================================
106. CLOUD DEPLOYMENT
============================================================

Support:

AWS

Azure

GCP

Customer cloud


Do not tightly couple business logic to one provider.


Infrastructure should be abstracted where appropriate.


Cloud components may include:

- Managed database
- Object storage
- Cache
- Queue
- Secret manager
- Key management
- Container platform
- Kubernetes
- Monitoring
- Logging
- CDN


The final cloud architecture must be justified.


============================================================
107. ON-PREM DEPLOYMENT
============================================================

A customer must be able to run TrueMark internally.

Potential components:

Application

Database

Object storage

Cache

Queue

AI

Monitoring

Logging

Identity integration

Secrets/key management


Customer data should be capable of remaining entirely within the
customer environment.


============================================================
108. ON-PREM STORAGE
============================================================

If deployed on-premises:

Use local/customer-controlled storage.

Do not assume AWS S3 exists.

Support S3-compatible object storage or appropriate local enterprise
storage.


Images and evidence must remain inside the customer's environment
when required by policy.


============================================================
109. ON-PREM SECRET MANAGEMENT
============================================================

If deployed on-prem:

Do not require cloud-specific secret services.

Support configurable enterprise secret management.

Examples:

Vault

Kubernetes Secrets with appropriate encryption

Customer key management

Other approved enterprise secret management


The application must abstract the secret provider.


============================================================
110. HYBRID DEPLOYMENT
============================================================

Support:

Core on-prem + AI cloud

Core cloud + customer data on-prem

Core on-prem + AI on-prem

Other supported hybrid combinations


The architecture must clearly document:

Data flows

Trust boundaries

Authentication

Encryption

Network requirements

Failure behavior


============================================================
111. DISASTER RECOVERY
============================================================

Support:

- Database backup
- Object storage backup
- Configuration backup
- Audit preservation
- Recovery procedures
- Disaster recovery documentation
- Restore testing


Tenant/domain/product/QR historical relationships must remain
consistent after restoration.


============================================================
112. CI/CD
============================================================

Support production-grade CI/CD.

Pipeline should include:

Lint

Unit tests

Integration tests

API tests

Security checks

Dependency scanning

Container scanning

Build

Artifact creation

Deployment

Smoke tests

Rollback strategy


Use appropriate tooling based on repository and deployment model.


============================================================
113. KUBERNETES
============================================================

Where Kubernetes is used:

Support appropriate:

- Deployments
- Services
- Ingress
- ConfigMaps
- Secrets/secret provider integration
- Persistent storage
- Health checks
- Autoscaling where appropriate
- Resource limits
- Network policies
- RBAC
- Pod security
- Observability


Do not introduce Kubernetes complexity where it is unnecessary.


============================================================
114. TESTING
============================================================

Create comprehensive:

Unit tests

Integration tests

API tests

E2E tests

Security tests

Performance tests

Deployment tests


Test at minimum:

- Tenant isolation
- Domain validation
- QR generation
- QR verification
- Manual code verification
- Serial uniqueness
- Credential uniqueness
- Bulk generation
- QR customization
- Product lifecycle
- Batch lifecycle
- QR lifecycle
- Repeat verification
- Clone detection
- AI disabled
- AI enabled
- AI unavailable
- Image rejection
- OCR
- Multi-angle validation
- Consumer reporting
- Authorization
- Rate limiting
- Enumeration resistance
- Cloud deployment
- On-prem deployment
- Backup/restore


============================================================
115. ARCHITECTURE RESEARCH
============================================================

Before implementation, research current official documentation and
standards.

Research:

- QR/product identification standards
- GS1 Digital Link where relevant
- OWASP API Security
- NIST AI Risk Management Framework
- Relevant product-fraud standards
- Current Next.js
- Current React
- Current Node.js
- Current NestJS
- Current PostgreSQL
- Current ORM
- Current Auth0/OIDC implementation
- Current Docker
- Current Kubernetes
- Current cloud storage
- Current secret-management systems
- Current OCR technology
- Current AI vision technology
- Current mobile camera/scanning libraries


Prefer primary/official sources.

Do not blindly copy outdated tutorials.


============================================================
116. IMPLEMENTATION PHASES
============================================================

PHASE 0:

Repository inspection

Research

Requirements

Architecture

Threat model

Security model

Technology decisions

Acceptance criteria


------------------------------------------------------------

PHASE 1:

FOUNDATION

Admin authentication

Configuration

Organizations/Tenants

Tenant isolation

Domain configuration

Core infrastructure

Observability

Security


------------------------------------------------------------

PHASE 2:

TENANT + DOMAIN ONBOARDING

Company profile

Company domain

TrueMark verification domain

Domain lifecycle

Domain validation

Domain administration

Tenant configuration


------------------------------------------------------------

PHASE 3:

PRODUCT FOUNDATION

Manufacturer

Brand

Product

Variant

Batch

Product unit

Serial

Verification credential

Product lifecycle


------------------------------------------------------------

PHASE 4:

QR SYSTEM

QR generation

QR lifecycle

QR verification

QR customization

QR preview

QR export

Bulk QR generation

QR security


------------------------------------------------------------

PHASE 5:

CORE VERIFICATION

QR scanning

Manual code entry

Domain validation

Tenant resolution

QR validation

Credential validation

Product identity

Registered information

Verification history

Repeated validation

Reuse intelligence

Clone signals

Analytics

NO AI.


------------------------------------------------------------

PHASE 6:

AI CONFIGURATION

AI enable/disable

AI optional/required

AI quotas

Reference data

Image requirements

Required views

Optional views


------------------------------------------------------------

PHASE 7:

AI CAPTURE

Image quality

Multi-angle

OCR

Data extraction

Database comparison


------------------------------------------------------------

PHASE 8:

VISUAL AI

Packaging

Logo

Security features

Multi-angle comparison

AI confidence


------------------------------------------------------------

PHASE 9:

FRAUD INTELLIGENCE

Clone detection

Risk scoring

Investigations

Reports

Alerts


------------------------------------------------------------

PHASE 10:

ANALYTICS

Dashboard

Verification analytics

Fraud analytics

Product analytics

Batch analytics

Location analytics

AI analytics


------------------------------------------------------------

PHASE 11:

CLOUD

AWS

Azure

GCP

Customer cloud

Cloud storage

Secrets

Kubernetes

CI/CD

Monitoring


------------------------------------------------------------

PHASE 12:

ON-PREM

Local/customer storage

Database

Secrets

Key management

Identity

Monitoring

Logging

AI


------------------------------------------------------------

PHASE 13:

HYBRID

Hybrid architecture

Hybrid AI

Data boundaries

Network security

Failure handling


------------------------------------------------------------

PHASE 14:

SECURITY HARDENING

Performance

E2E

Security tests

Threat model validation

Disaster recovery

Documentation

Production readiness


============================================================
117. IMPLEMENTATION METHOD
============================================================

Do NOT immediately generate the entire codebase.

FIRST:

1. Inspect the repository.
2. Research official documentation.
3. Identify existing code.
4. Identify reusable code.
5. Identify existing architecture.
6. Produce architecture.
7. Produce tenant model.
8. Produce domain model.
9. Produce product identity model.
10. Produce QR architecture.
11. Produce Core vs AI boundaries.
12. Produce threat model.
13. Identify risks.
14. Define implementation phases.
15. Define acceptance criteria.
16. Identify dependencies.
17. Identify deployment strategy.


Then implement incrementally.


For each phase:

BUILD

→ TEST

→ SECURITY CHECK

→ VALIDATE

→ DOCUMENT

→ CONTINUE


Keep the application runnable at every stage.


============================================================
118. DO NOT OVERENGINEER
============================================================

Do not introduce microservices merely for the sake of microservices.

Do not introduce Kubernetes merely because Kubernetes is listed.

Do not introduce queues unless asynchronous processing requires them.

Do not introduce AI unless configured.

Do not introduce cloud-specific services where an abstraction is
appropriate.

Prefer a modular, maintainable architecture.

The implementation must be production-grade without unnecessary
complexity.


============================================================
119. DOCUMENTATION
============================================================

Create professional documentation covering:

Product

Architecture

Tenant model

Client onboarding

Domain configuration

QR generation

QR customization

Core verification

Manual verification

AI verification

Fraud intelligence

Multiple validation

QR security

Domain security

URL security

AI governance

Security

Privacy

Cloud deployment

On-prem deployment

Hybrid deployment

Administration

Operations

API

Testing

Troubleshooting

Backup

Disaster recovery

Data retention

Secret management

Key management

Deployment runbooks


============================================================
120. REQUIRED ARCHITECTURE DOCUMENT
============================================================

Before major implementation, create:

1. System architecture
2. Deployment architecture
3. Tenant architecture
4. Domain architecture
5. Product identity architecture
6. QR architecture
7. Core verification flow
8. Manual verification flow
9. AI flow
10. Fraud flow
11. Storage architecture
12. Secret management architecture
13. Cloud architecture
14. On-prem architecture
15. Hybrid architecture
16. Security architecture
17. Threat model
18. Data-flow diagrams
19. API boundaries
20. Failure handling


============================================================
121. REQUIRED PRODUCT FLOWS
============================================================

Document these flows:

FLOW 1

Tenant onboarding


FLOW 2

Company domain configuration


FLOW 3

TrueMark verification domain configuration


FLOW 4

Product creation


FLOW 5

Bulk product-unit generation


FLOW 6

Serial generation


FLOW 7

Verification credential generation


FLOW 8

QR generation


FLOW 9

QR customization


FLOW 10

QR verification


FLOW 11

Manual code verification


FLOW 12

Repeated verification


FLOW 13

Clone detection


FLOW 14

AI validation


FLOW 15

Fraud investigation


FLOW 16

Consumer reporting


FLOW 17

Cloud deployment


FLOW 18

On-prem deployment


FLOW 19

Hybrid deployment


============================================================
122. REQUIRED SECURITY PROPERTIES
============================================================

The system MUST:

1. Prevent tenant escape.
2. Prevent QR enumeration.
3. Prevent verification-code guessing.
4. Prevent open redirects.
5. Prevent domain spoofing.
6. Prevent secret leakage.
7. Prevent internal-ID exposure.
8. Rate-limit public verification.
9. Protect image uploads.
10. Protect APIs.
11. Protect admin authentication.
12. Preserve audit trails.
13. Protect historical evidence.
14. Encrypt sensitive data.
15. Protect cryptographic keys.
16. Support key rotation where appropriate.
17. Validate authorization server-side.
18. Prevent cross-tenant object access.
19. Prevent unrestricted resource consumption.
20. Prevent malicious AI input where applicable.


============================================================
123. NON-FUNCTIONAL REQUIREMENTS
============================================================

The platform must be:

Secure

Scalable

Observable

Maintainable

Testable

Auditable

Multi-tenant

Cloud portable

On-prem deployable

Hybrid capable

Highly available where required

Disaster recoverable

Configurable

Extensible


Core verification should be optimized for low latency.


============================================================
124. FINAL NON-NEGOTIABLE RULES
============================================================

1. Consumer does not login.

2. Admin requires authentication.

3. Core is digital product identity authentication.

4. Core must be fast.

5. Core does not run AI.

6. Core does not run OCR.

7. Core does not require images.

8. Core shows registered manufacturer information.

9. AI is optional.

10. AI can be disabled.

11. AI can be enabled later.

12. AI can be optional or required.

13. AI performs physical product validation.

14. AI extracts physical product information.

15. AI extracted information is compared with authoritative data.

16. Poor images require retake/reupload.

17. Front/back/left/right/top/bottom are supported.

18. Each view can be required or optional.

19. Additional images are supported.

20. More images may improve assessment.

21. AI confidence is not proof.

22. Fraud risk is separate from AI confidence.

23. Digital authentication is separate from physical validation.

24. Valid QR does not guarantee physical authenticity.

25. Invalid QR cannot become genuine through AI.

26. Revoked QR cannot become genuine through AI.

27. Blocked QR cannot become genuine through AI.

28. Repeated scans are not automatically counterfeit.

29. QR cloning must be considered.

30. Serial cloning must be considered.

31. QR + serial copying must be considered.

32. Geographic anomalies must be considered.

33. High-frequency scans must be considered.

34. Every verification event must be captured.

35. Every AI execution must be captured.

36. Fraud signals must preserve source and evidence.

37. Admin must identify fraud hotspots.

38. Admin must identify high-risk products.

39. Admin must identify high-risk batches.

40. Admin must identify high-risk areas.

41. Genuine/suspicious/counterfeit analytics must be captured.

42. Analytics must be data-driven.

43. Consumer reports require no login.

44. Investigations must be auditable.

45. Historical evidence must be preserved.

46. Cloud deployment must be supported.

47. On-prem deployment must be supported.

48. Hybrid deployment should be supported.

49. AI should support cloud/on-prem/hybrid where feasible.

50. Tenant-specific verification domains must be supported.

51. Company domains must be supported.

52. Company domain configuration must be stored in the database.

53. TrueMark verification domain configuration must be stored in the
database.

54. QR generation must use the tenant's configured verification domain.

55. QR verification must validate the configured domain.

56. Manual verification-code entry must be supported.

57. QR scanning must automatically supply the verification credential.

58. Product-unit creation must generate unique credentials.

59. Each physical product unit must have a unique serial.

60. Each physical product unit must have a unique secure verification
credential.

61. Each physical product unit must have a unique QR identity.

62. Bulk product-unit generation must be supported.

63. QR customization must be available in the Admin sidebar.

64. QR size and presentation must be configurable.

65. QR visual customization must not alter authentication identity.

66. Internal IDs must not be exposed.

67. Verification credentials must not be predictable.

68. Secrets must not be committed.

69. Secrets must use appropriate secret-management mechanisms.

70. Cloud deployments must support cloud-native secret management.

71. On-prem deployments must support customer-controlled secret/key
management.

72. Cloud deployments must support cloud object storage.

73. On-prem deployments must support customer-controlled object storage.

74. Business logic must not be tightly coupled to one cloud provider.

75. Public verification APIs must be rate-limited.

76. Public verification APIs must resist enumeration.

77. Open redirects must be prevented.

78. Tenant isolation must be enforced server-side.

79. AI must not override authoritative Core verification.

80. AI must not make unsupported legal claims.

81. No fabricated results.

82. No fabricated analytics.

83. No hardcoded production business data.

84. No hardcoded tenant domains.

85. No hardcoded credentials.

86. Historical verification context must remain explainable.

87. Every important administrative change must be auditable.

88. Production architecture must be documented.

89. Deployment architecture must be documented.

90. Security architecture must be documented.

91. Threat model must be documented.

92. Acceptance tests must pass before production readiness.

93. Do not generate the entire codebase blindly.

94. Inspect existing repository/code first.

95. Research current official documentation first.

96. Build incrementally.

97. Test every phase.

98. Security-check every phase.

99. Keep the application runnable.

100. Do not silently invent unsupported functionality or business rules.


============================================================
125. FINAL DELIVERABLE
============================================================

Before considering the project complete, provide:

1. Production architecture
2. Tenant architecture
3. Domain architecture
4. Product identity architecture
5. QR architecture
6. Core verification architecture
7. Manual verification architecture
8. AI architecture
9. Fraud architecture
10. Database/data model
11. API specification
12. Admin UI structure
13. Consumer UI structure
14. QR customization UI
15. Security model
16. Threat model
17. Cloud deployment
18. On-prem deployment
19. Hybrid deployment
20. CI/CD
21. Monitoring
22. Logging
23. Backup
24. Disaster recovery
25. Testing strategy
26. Deployment runbooks
27. Troubleshooting documentation
28. Production readiness checklist


============================================================
126. MOST IMPORTANT PRODUCT FLOW
============================================================

The final system should support this complete lifecycle:

CUSTOMER ONBOARDING
        ↓
CREATE TENANT
        ↓
CONFIGURE COMPANY DOMAIN
        ↓
CONFIGURE TRUE MARK VERIFICATION DOMAIN
        ↓
STORE DOMAIN CONFIGURATION IN DATABASE
        ↓
CREATE MANUFACTURER
        ↓
CREATE BRAND
        ↓
CREATE PRODUCT
        ↓
CREATE BATCH
        ↓
GENERATE PRODUCT UNITS
        ↓
GENERATE UNIQUE SERIAL
        ↓
GENERATE UNIQUE SECURE VERIFICATION CREDENTIAL
        ↓
GENERATE UNIQUE QR
        ↓
APPLY QR CUSTOMIZATION
        ↓
PRINT / DISTRIBUTE PRODUCT
        ↓
CONSUMER SCANS QR
        ↓
VALIDATE VERIFICATION DOMAIN
        ↓
RESOLVE TENANT
        ↓
VALIDATE QR
        ↓
VALIDATE SECURE CREDENTIAL
        ↓
VALIDATE PRODUCT IDENTITY
        ↓
CHECK PRODUCT/BATCH/QR LIFECYCLE
        ↓
CHECK HISTORICAL VERIFICATION
        ↓
CALCULATE REUSE/CLONE SIGNALS
        ↓
CORE RESULT
        ↓
OPTIONAL AI VALIDATION
        ↓
PHYSICAL VALIDATION
        ↓
FRAUD INTELLIGENCE
        ↓
FINAL CONSUMER RESULT
        ↓
STORE VERIFICATION EVENT
        ↓
UPDATE ANALYTICS
        ↓
OPTIONAL FRAUD INVESTIGATION


============================================================
127. GOLDEN ARCHITECTURAL PRINCIPLE
============================================================

TrueMark is NOT simply a QR scanner.

TrueMark is a:

MULTI-TENANT PRODUCT IDENTITY
+
SECURE VERIFICATION
+
QR/SECURE-CODE SYSTEM
+
PRODUCT TRACEABILITY
+
FRAUD INTELLIGENCE
+
OPTIONAL PHYSICAL AI VALIDATION
+
ENTERPRISE DEPLOYMENT PLATFORM


The system must be designed around this principle.


============================================================
128. STARTING INSTRUCTION TO THE CODING AGENT
============================================================

DO NOT START CODING THE ENTIRE APPLICATION IMMEDIATELY.

FIRST:

1. Inspect the repository.
2. Understand the existing application.
3. Identify frontend/backend/database components.
4. Identify reusable functionality.
5. Identify missing functionality.
6. Identify architectural problems.
7. Research official/current documentation.
8. Produce the proposed architecture.
9. Produce the tenant model.
10. Produce the domain model.
11. Produce the product-unit/serial/credential/QR model.
12. Produce the Core verification flow.
13. Produce the manual verification flow.
14. Produce the QR customization architecture.
15. Produce the AI boundary.
16. Produce the fraud architecture.
17. Produce the security threat model.
18. Produce the cloud deployment architecture.
19. Produce the on-prem deployment architecture.
20. Produce the hybrid architecture.
21. Produce implementation phases.
22. Produce acceptance criteria.
23. Identify risks and trade-offs.

Then ask:

"Architecture review complete. Ready to implement Phase 1."

Only after the architecture is reviewed should implementation begin.


============================================================
END OF TRUEMARK MASTER PROMPT
============================================================