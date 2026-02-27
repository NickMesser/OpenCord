/* eslint-disable */
/* tslint:disable */
import {
  TypeBuilder as __TypeBuilder,
  t as __t,
  type AlgebraicTypeType as __AlgebraicTypeType,
  type Infer as __Infer,
} from "spacetimedb";

export default __t.row({
  channelId: __t.u64().primaryKey().name("channel_id"),
  audioTargetSampleRate: __t.u32().name("audio_target_sample_rate"),
  audioFrameMs: __t.u16().name("audio_frame_ms"),
  audioMaxFrameBytes: __t.u32().name("audio_max_frame_bytes"),
  audioBitrateKbps: __t.u32().name("audio_bitrate_kbps"),
  audioTalkingRmsThreshold: __t.f32().name("audio_talking_rms_threshold"),
  videoEnabled: __t.bool().name("video_enabled"),
  videoWidth: __t.u16().name("video_width"),
  videoHeight: __t.u16().name("video_height"),
  videoFps: __t.u8().name("video_fps"),
  videoJpegQuality: __t.f32().name("video_jpeg_quality"),
  videoMaxFrameBytes: __t.u32().name("video_max_frame_bytes"),
});
