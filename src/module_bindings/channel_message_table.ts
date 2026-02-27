/* eslint-disable */
/* tslint:disable */
import {
  TypeBuilder as __TypeBuilder,
  t as __t,
  type AlgebraicTypeType as __AlgebraicTypeType,
  type Infer as __Infer,
} from "spacetimedb";

export default __t.row({
  id: __t.u64().primaryKey(),
  channelId: __t.u64().name("channel_id"),
  senderId: __t.u64().name("sender_id"),
  content: __t.string(),
  sentAt: __t.timestamp().name("sent_at"),
});
