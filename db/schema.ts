import { sqliteTable, text, integer, index, primaryKey } from 'drizzle-orm/sqlite-core';
export const calendarStates=sqliteTable('calendar_states',{
 owner:text('owner').notNull(),id:text('id').notNull(),deleted:integer('deleted',{mode:'boolean'}).notNull(),version:integer('version').notNull(),
},t=>[primaryKey({columns:[t.owner,t.id]})]);
export const calendarColors = sqliteTable('calendar_colors', {
 owner:text('owner').notNull(),id:text('id').notNull(),color:text('color'),version:integer('version').notNull(),
},t=>[primaryKey({columns:[t.owner,t.id]})]);
export const events = sqliteTable('events', {
 id: text('id').primaryKey(), owner: text('owner').notNull(), title: text('title').notNull(),
 start: text('start').notNull(), end: text('end').notNull(), calendar: text('calendar').notNull(),
 description: text('description').notNull(), location: text('location').notNull(),
 contactName:text('contact_name').notNull().default(''),companyName:text('company_name').notNull().default(''),phone:text('phone').notNull().default(''),timezone:text('timezone').notNull().default(''),
 allDay: integer('all_day',{mode:'boolean'}).notNull(), version: integer('version').notNull(),
}, t => [index('events_owner').on(t.owner)]);
export const calendarNames = sqliteTable('calendar_names', {
 owner: text('owner').notNull(), id: text('id').notNull(), name: text('name').notNull(),
 version: integer('version').notNull(),
}, t => [primaryKey({columns:[t.owner,t.id]})]);
export const trainingRuns = sqliteTable('training_runs', {
 id:text('id').primaryKey(),owner:text('owner').notNull(),payload:text('payload').notNull(),
 targets:text('targets').notNull(),outcomes:text('outcomes').notNull(),
 state:text('state').notNull(),createdAt:integer('created_at').notNull(),
},t=>[index('training_runs_owner').on(t.owner)]);
export const deletionRuns=sqliteTable('deletion_runs',{
 id:text('id').primaryKey(),owner:text('owner').notNull(),targets:text('targets').notNull(),outcomes:text('outcomes').notNull(),state:text('state').notNull(),createdAt:integer('created_at').notNull(),
},t=>[index('deletion_runs_owner').on(t.owner)]);
export const googleConnections=sqliteTable('google_connections',{
 owner:text('owner').primaryKey(),email:text('email').notNull(),subject:text('subject').notNull(),
 tokens:text('tokens').notNull(),status:text('status').notNull(),updatedAt:integer('updated_at').notNull(),
});
export const googleOauthStates=sqliteTable('google_oauth_states',{
 hash:text('hash').primaryKey(),owner:text('owner').notNull(),verifier:text('verifier').notNull(),expiresAt:integer('expires_at').notNull(),
},t=>[index('google_oauth_states_owner').on(t.owner)]);
export const googleUpdateRuns=sqliteTable('google_update_runs',{
 id:text('id').primaryKey(),owner:text('owner').notNull(),payload:text('payload').notNull(),outcome:text('outcome').notNull(),state:text('state').notNull(),createdAt:integer('created_at').notNull(),
},t=>[index('google_update_runs_owner').on(t.owner)]);
export const eventTransferRuns=sqliteTable('event_transfer_runs',{
 id:text('id').primaryKey(),owner:text('owner').notNull(),payload:text('payload').notNull(),outcome:text('outcome').notNull(),state:text('state').notNull(),createdAt:integer('created_at').notNull(),
},t=>[index('event_transfer_runs_owner').on(t.owner)]);
