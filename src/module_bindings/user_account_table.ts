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
  email: __t.string().unique().name("email"),
  username: __t.string().unique().name("username"),
  passwordHash: __t.string().name("password_hash"),
  displayName: __t.string().name("display_name"),
  avatarUrl: __t.string().name("avatar_url"),
  createdAt: __t.timestamp().name("created_at"),
});
