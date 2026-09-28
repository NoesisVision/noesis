/**
 * A working file is one document someone just wrote, so anything this large
 * is the wrong file — an index, a log, a dump. Reading it would pull the whole
 * file into memory before the shape is known.
 */
export const MAX_WORKING_FILE_BYTES = 4 * 1024 * 1024;
