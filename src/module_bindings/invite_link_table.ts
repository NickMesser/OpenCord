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
  serverId: __t.u64().name("server_id"),
  code: __t.string().unique().name("code"),
  createdBy: __t.u64().name("created_by"),
  maxUses: __t.u32().name("max_uses"),
  uses: __t.u32(),
  createdAt: __t.timestamp().name("created_at"),
});
