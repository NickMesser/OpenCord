/* eslint-disable */
/* tslint:disable */
import {
  TypeBuilder as __TypeBuilder,
  t as __t,
  type AlgebraicTypeType as __AlgebraicTypeType,
  type Infer as __Infer,
} from "spacetimedb";

export default {
  channelId: __t.u64(),
  seq: __t.u32(),
  sampleRate: __t.u32(),
  channels: __t.u8(),
  rms: __t.f32(),
  pcm16le: __t.byteArray(),
};
