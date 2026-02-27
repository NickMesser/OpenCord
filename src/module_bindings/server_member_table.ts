/* eslint-disable */
/* tslint:disable */
import {
  TypeBuilder as __TypeBuilder,
  t as __t,
  type AlgebraicTypeType as __AlgebraicTypeType,
  type Infer as __Infer,
} from "spacetimedb";
import { MemberRole } from "./types";

export default __t.row({
  id: __t.u64().primaryKey(),
  serverId: __t.u64().name("server_id"),
  userId: __t.u64().name("user_id"),
  get role() {
    return MemberRole;
  },
  joinedAt: __t.timestamp().name("joined_at"),
});
