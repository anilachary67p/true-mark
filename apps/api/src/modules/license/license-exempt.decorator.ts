import { SetMetadata } from '@nestjs/common';

export const LICENSE_EXEMPT_KEY = 'licenseExempt';
export const LicenseExempt = () => SetMetadata(LICENSE_EXEMPT_KEY, true);
