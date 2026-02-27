/* eslint-disable */
/* tslint:disable */
import {
  TypeBuilder as __TypeBuilder,
  t as __t,
  type AlgebraicTypeType as __AlgebraicTypeType,
  type Infer as __Infer,
} from "spacetimedb";

export default __t.row({
  channelId: __t.u64().name("channel_id"),
  from: __t.identity(),
  seq: __t.u32(),
  width: __t.u16(),
  height: __t.u16(),
  jpeg: __t.byteArray(),
});
