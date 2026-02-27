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
  audioTargetSampleRate: __t.u32(),
  audioFrameMs: __t.u16(),
  audioMaxFrameBytes: __t.u32(),
  audioBitrateKbps: __t.u32(),
  audioTalkingRmsThreshold: __t.f32(),
  videoEnabled: __t.bool(),
  videoWidth: __t.u16(),
  videoHeight: __t.u16(),
  videoFps: __t.u8(),
  videoJpegQuality: __t.f32(),
  videoMaxFrameBytes: __t.u32(),
};
