/* eslint-disable */
/* tslint:disable */
import {
  TypeBuilder as __TypeBuilder,
  t as __t,
  type AlgebraicTypeType as __AlgebraicTypeType,
  type Infer as __Infer,
} from "spacetimedb";

export default __t.row({
  identity: __t.identity().primaryKey(),
  userId: __t.u64().name("user_id"),
  connectedAt: __t.timestamp().name("connected_at"),
});
