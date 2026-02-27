/* eslint-disable */
/* tslint:disable */
import {
  TypeBuilder as __TypeBuilder,
  t as __t,
  type AlgebraicTypeType as __AlgebraicTypeType,
  type Infer as __Infer,
} from "spacetimedb";
import { ChannelType } from "./types";

export default __t.row({
  id: __t.u64().primaryKey(),
  serverId: __t.u64().name("server_id"),
  categoryId: __t.u64().name("category_id"),
  name: __t.string(),
  get channelType() {
    return ChannelType.name("channel_type");
  },
  position: __t.u32(),
  createdAt: __t.timestamp().name("created_at"),
});
