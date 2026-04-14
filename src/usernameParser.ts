import { ValidationError } from './types';

const VALID_USERNAME_REGEX = /^[a-zA-Z0-9-]+$/;

/**
 * Parses a path segment containing one or more GitHub usernames
 * separated by `+` and validates each username.
 */
export function parseUsernames(path: string): string[] {
  const usernames = path.split('+');

  if (usernames.length === 0 || (usernames.length === 1 && usernames[0] === '')) {
    const error: ValidationError = {
      type: 'validation',
      message: 'At least one username is required',
    };
    throw error;
  }

  const invalidUsernames = usernames.filter(
    (u) => u === '' || !VALID_USERNAME_REGEX.test(u)
  );

  if (invalidUsernames.length > 0) {
    const error: ValidationError = {
      type: 'validation',
      message: `Invalid username(s): ${invalidUsernames.join(', ')}`,
      invalidUsernames,
    };
    throw error;
  }

  return usernames;
}
