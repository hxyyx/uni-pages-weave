export const DEFAULT_PROJECT_DIR = '.';
export const DEFAULT_TEXT_ENCODING = 'utf8';

export const UNI_PROJECT_SRC_DIR = 'src';
export const UNI_PROJECT_MODE_CLI = 'cli';
export const UNI_PROJECT_MODE_HBUILDX = 'hbuildx';

export const UNI_PAGES_JSON_FILE = 'pages.json';
export const UNI_PAGES_JSON_BACKUP_FILE = 'pages.json.bak';
export const UNI_PAGES_KEY = 'pages';

// uni-app uses subPackages, while UPW canonical config uses lowercase.
export const UNI_SUBPACKAGES_KEY = 'subPackages';
export const UNI_SUBPACKAGES_COMPAT_KEY = 'subpackages';
export const UPW_SUBPACKAGES_KEY = 'subpackages';

export const UPW_CLI_NAME = 'upw';

export const UPW_TARGET_DIR = '.upw';
export const UPW_APP_FILE = 'app.upw.json';
export const UPW_PAGE_EXTENSION = '.upw.json';
export const UPW_PAGE_FILE_GLOB = '*.upw.json';
export const UPW_PAGE_FILE_PATTERN = /\.upw\.json$/u;
export const UPW_PAGES_DIR = 'pages';
export const UPW_PLATFORMS_DIR = 'platforms';

export const UNI_PAGE_PATH_KEY = 'path';
export const UNI_SUB_PACKAGE_NAME_KEY = 'name';
export const UNI_SUB_PACKAGE_ROOT_KEY = 'root';
export const UPW_HOME_PATH_KEY = 'homePath';

export const UPW_IFDEF_DIRECTIVE = 'ifdef';
export const UPW_IFNDEF_DIRECTIVE = 'ifndef';
export const UPW_IFDEF_COMMENT = `#${UPW_IFDEF_DIRECTIVE}`;
export const UPW_IFNDEF_COMMENT = `#${UPW_IFNDEF_DIRECTIVE}`;
export const UPW_ENDIF_COMMENT = '#endif';
export const UPW_IF_DIRECTIVE_PATTERN = /^#(ifdef|ifndef)\s+(.+?)\s*$/u;
export const UPW_ENDIF_DIRECTIVE_PATTERN = /^#endif\s*$/u;

export const UPW_META_KEY = '$upw';
export const UPW_META_SUBPACKAGE_KEY = 'subpackageName';
export const UPW_META_CONDITIONS_KEY = 'conditions';
export const UPW_META_WHEN_KEY = 'when';
export const UPW_META_UNLESS_KEY = 'unless';
export const UPW_META_PATCHES_KEY = 'patches';
export const UPW_META_PATCH_KEY = 'patch';
export const UPW_META_CHILDREN_KEY = 'children';

export const UPW_META_ALLOWED_KEYS = [
  UPW_META_SUBPACKAGE_KEY,
  UPW_META_CONDITIONS_KEY,
  UPW_META_WHEN_KEY,
  UPW_META_UNLESS_KEY,
  UPW_META_PATCHES_KEY,
] as const;

export const UPW_APP_META_ALLOWED_KEYS = [UPW_META_PATCHES_KEY] as const;

export const UPW_CONDITIONAL_PATCH_ALLOWED_KEYS = [
  UPW_META_CONDITIONS_KEY,
  UPW_META_WHEN_KEY,
  UPW_META_UNLESS_KEY,
  UPW_META_PATCH_KEY,
  UPW_META_CHILDREN_KEY,
] as const;

export const UPW_CONDITIONAL_CHILD_PATCH_ALLOWED_KEYS = [
  UPW_META_CONDITIONS_KEY,
  UPW_META_WHEN_KEY,
  UPW_META_UNLESS_KEY,
  UPW_META_PATCH_KEY,
] as const;
