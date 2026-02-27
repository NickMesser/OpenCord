/* eslint-disable */
/* tslint:disable */
import {
  TypeBuilder as __TypeBuilder,
  t as __t,
  type AlgebraicTypeType as __AlgebraicTypeType,
  type Infer as __Infer,
} from "spacetimedb";
import { ChannelType } from "./types";

export default {
  serverId: __t.u64(),
  categoryId: __t.u64(),
  name: __t.string(),
  get channelType() {
    return ChannelType;
  },
};
