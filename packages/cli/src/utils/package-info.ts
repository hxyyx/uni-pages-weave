import packageManifest from '../../package.json' with { type: 'json' };

function resolvePackageVersion(): string {
  if (typeof packageManifest.version !== 'string' || packageManifest.version.trim() === '') {
    throw new Error('Invalid CLI package version.');
  }

  return packageManifest.version;
}

export const PACKAGE_VERSION = resolvePackageVersion();
