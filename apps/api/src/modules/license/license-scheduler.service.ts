import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { LicenseService } from './license.service';

@Injectable()
export class LicenseSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(LicenseSchedulerService.name);
  private interval?: NodeJS.Timeout;

  constructor(private readonly licenseService: LicenseService) {}

  onModuleInit() {
    if (process.env.DISABLE_LICENSE_SCHEDULER === 'true') return;

    // Daily validation at startup and every 24 hours
    void this.licenseService.validateAllTenants('scheduler-init');
    this.interval = setInterval(
      () => {
        void this.licenseService.validateAllTenants('scheduler-daily');
      },
      24 * 60 * 60 * 1000,
    );
    this.logger.log('License validation scheduler registered (every 24h)');
  }
}
