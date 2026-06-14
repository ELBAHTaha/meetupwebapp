import { SetMetadata } from '@nestjs/common';

export const OPTIONAL_AUTH_KEY = 'optionalAuth';

/**
 * Marks a route as public BUT still attaches the user if a valid token is
 * present (used for personalised-but-public reads like the events feed).
 */
export const OptionalAuth = () => SetMetadata(OPTIONAL_AUTH_KEY, true);
