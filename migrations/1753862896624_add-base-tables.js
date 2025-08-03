/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
  pgm.createTable('accounts', {
    id: { type: 'serial', primaryKey: true },
    apiId: { type: 'integer', notNull: true, unique: true },
    apiHash: {type: "text", notNull: true, unique: true  },
    session: {type: 'text', notNull: false, default: null }
  });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  pgm.dropTable('accounts');
};