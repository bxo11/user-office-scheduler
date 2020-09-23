/* eslint-disable @typescript-eslint/camelcase */
import { ScheduledEvent } from '../../models/ScheduledEvent';
import { NewScheduledEventInput } from '../../resolvers/mutations/CreateScheduledEventMutation';
import { ScheduledEventFilter } from '../../resolvers/queries/ScheduledEventsQuery';
import {
  ScheduledEventDataSource,
  ScheduledEventDataSourceErrorTypes,
  ScheduledEventDataSourceError,
} from '../ScheduledEventDataSource';
import database from './database';
import { ScheduledEventRecord, createScheduledEventObject } from './records';

// TODO: move to a general place
type MetaFields = 'created_at' | 'updated_at';

type CreateFields = Omit<
  ScheduledEventRecord,
  'scheduled_event_id' | MetaFields
>;

export default class PostgreScheduledEventDataSource
  implements ScheduledEventDataSource {
  readonly tableName = 'scheduled_events';

  async create(
    newScheduledEvent: NewScheduledEventInput
  ): Promise<ScheduledEvent> {
    return database.transaction(async trx => {
      // I don't know how strict we want to be about scheduled events
      // supposedly this should prevent other writes to happen while allows reads
      await trx.raw(`LOCK TABLE ${this.tableName} IN EXCLUSIVE MODE`, []);

      const { count } = await trx<ScheduledEventRecord>(this.tableName)
        .count('*')
        //
        .where('starts_at', '>=', newScheduledEvent.startsAt)
        .andWhere('ends_at', '<=', newScheduledEvent.endsAt)
        //
        .orWhere('starts_at', '<', newScheduledEvent.endsAt)
        .andWhere('ends_at', '>', newScheduledEvent.startsAt)
        .first<{ count: string }>();

      if (+count > 0) {
        throw new ScheduledEventDataSourceError(
          ScheduledEventDataSourceErrorTypes.SCHEDULED_EVENT_OVERLAP
        );
      }

      const [scheduledEvent] = await trx
        .insert<CreateFields>({
          booking_type: newScheduledEvent.bookingType,
          starts_at: newScheduledEvent.startsAt,
          ends_at: newScheduledEvent.endsAt,
          scheduled_by: newScheduledEvent.scheduledById,
          description: newScheduledEvent.description,
        })
        .into(this.tableName)
        .returning<ScheduledEventRecord[]>(['*']);

      return createScheduledEventObject(scheduledEvent);
    });
  }

  async delete(): Promise<null> {
    // TODO: decide if we can delete scheduled events or not (maybe want to treat them as canceled)
    throw new Error('not implemented yet');
  }

  async scheduledEvent(id: number): Promise<ScheduledEvent | null> {
    const scheduledEvent = await database<ScheduledEventRecord>(this.tableName)
      .select()
      .where('scheduled_event_id', id)
      .first();

    return scheduledEvent ? createScheduledEventObject(scheduledEvent) : null;
  }

  async scheduledEvents(
    filter?: ScheduledEventFilter
  ): Promise<ScheduledEvent[]> {
    const qb = database<ScheduledEventRecord>(this.tableName).select();

    if (filter?.startsAt) {
      qb.where('starts_at', '>=', filter.startsAt);
    }

    if (filter?.endsAt) {
      qb.where('ends_at', '<=', filter.endsAt);
    }

    const scheduledEvents = await qb;

    return scheduledEvents.map(createScheduledEventObject);
  }
}
