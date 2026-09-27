/**
 * A working file is one document the agent just wrote, so anything this large
 * is the wrong path — an index, a log, a dump. Reading it would pull the whole
 * file into memory before the shape is known. The routes that take one as a
 * body refuse the same size.
 */
export const MAX_WORKING_FILE_BYTES = 4 * 1024 * 1024;
