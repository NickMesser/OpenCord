/* eslint-disable */
/* tslint:disable */
import {
  DbConnectionBuilder as __DbConnectionBuilder,
  DbConnectionImpl as __DbConnectionImpl,
  SubscriptionBuilderImpl as __SubscriptionBuilderImpl,
  TypeBuilder as __TypeBuilder,
  convertToAccessorMap as __convertToAccessorMap,
  makeQueryBuilder as __makeQueryBuilder,
  procedureSchema as __procedureSchema,
  procedures as __procedures,
  reducerSchema as __reducerSchema,
  reducers as __reducers,
  schema as __schema,
  t as __t,
  table as __table,
  type AlgebraicTypeType as __AlgebraicTypeType,
  type DbConnectionConfig as __DbConnectionConfig,
  type ErrorContextInterface as __ErrorContextInterface,
  type Event as __Event,
  type EventContextInterface as __EventContextInterface,
  type Infer as __Infer,
  type QueryBuilder as __QueryBuilder,
  type ReducerEventContextInterface as __ReducerEventContextInterface,
  type RemoteModule as __RemoteModule,
  type SubscriptionEventContextInterface as __SubscriptionEventContextInterface,
  type SubscriptionHandleImpl as __SubscriptionHandleImpl,
} from "spacetimedb";

// Import all reducer arg schemas
import RegisterReducer from "./register_reducer";
import LoginReducer from "./login_reducer";
import LogoutReducer from "./logout_reducer";
import CreateServerReducer from "./create_server_reducer";
import DeleteServerReducer from "./delete_server_reducer";
import CreateInviteReducer from "./create_invite_reducer";
import JoinServerReducer from "./join_server_reducer";
import LeaveServerReducer from "./leave_server_reducer";
import CreateCategoryReducer from "./create_category_reducer";
import DeleteCategoryReducer from "./delete_category_reducer";
import CreateChannelReducer from "./create_channel_reducer";
import DeleteChannelReducer from "./delete_channel_reducer";
import SendChannelMessageReducer from "./send_channel_message_reducer";
import DeleteMessageReducer from "./delete_message_reducer";
import JoinVoiceChannelReducer from "./join_voice_channel_reducer";
import LeaveVoiceChannelReducer from "./leave_voice_channel_reducer";
import SetChannelMediaSettingsReducer from "./set_channel_media_settings_reducer";
import SendAudioFrameReducer from "./send_audio_frame_reducer";
import SendVideoFrameReducer from "./send_video_frame_reducer";

// Import all table schema definitions
import UserAccountRow from "./user_account_table";
import UserSessionRow from "./user_session_table";
import ServerRow from "./server_table";
import ServerMemberRow from "./server_member_table";
import InviteLinkRow from "./invite_link_table";
import CategoryRow from "./category_table";
import ChannelRow from "./channel_table";
import ChannelMessageRow from "./channel_message_table";
import VoiceMemberRow from "./voice_member_table";
import ChannelMediaSettingsRow from "./channel_media_settings_table";
import AudioFrameEventRow from "./audio_frame_event_table";
import VideoFrameEventRow from "./video_frame_event_table";

const tablesSchema = __schema({
  user_account: __table({
    name: 'user_account',
    indexes: [
      { name: 'id', algorithm: 'btree', columns: ['id'] },
      { name: 'email', algorithm: 'btree', columns: ['email'] },
      { name: 'username', algorithm: 'btree', columns: ['username'] },
    ],
    constraints: [
      { name: 'user_account_id_key', constraint: 'unique', columns: ['id'] },
      { name: 'user_account_email_key', constraint: 'unique', columns: ['email'] },
      { name: 'user_account_username_key', constraint: 'unique', columns: ['username'] },
    ],
  }, UserAccountRow),
  user_session: __table({
    name: 'user_session',
    indexes: [
      { name: 'identity', algorithm: 'btree', columns: ['identity'] },
    ],
    constraints: [
      { name: 'user_session_identity_key', constraint: 'unique', columns: ['identity'] },
    ],
  }, UserSessionRow),
  server: __table({
    name: 'server',
    indexes: [
      { name: 'id', algorithm: 'btree', columns: ['id'] },
    ],
    constraints: [
      { name: 'server_id_key', constraint: 'unique', columns: ['id'] },
    ],
  }, ServerRow),
  server_member: __table({
    name: 'server_member',
    indexes: [
      { name: 'id', algorithm: 'btree', columns: ['id'] },
    ],
    constraints: [
      { name: 'server_member_id_key', constraint: 'unique', columns: ['id'] },
    ],
  }, ServerMemberRow),
  invite_link: __table({
    name: 'invite_link',
    indexes: [
      { name: 'id', algorithm: 'btree', columns: ['id'] },
      { name: 'code', algorithm: 'btree', columns: ['code'] },
    ],
    constraints: [
      { name: 'invite_link_id_key', constraint: 'unique', columns: ['id'] },
      { name: 'invite_link_code_key', constraint: 'unique', columns: ['code'] },
    ],
  }, InviteLinkRow),
  category: __table({
    name: 'category',
    indexes: [
      { name: 'id', algorithm: 'btree', columns: ['id'] },
    ],
    constraints: [
      { name: 'category_id_key', constraint: 'unique', columns: ['id'] },
    ],
  }, CategoryRow),
  channel: __table({
    name: 'channel',
    indexes: [
      { name: 'id', algorithm: 'btree', columns: ['id'] },
    ],
    constraints: [
      { name: 'channel_id_key', constraint: 'unique', columns: ['id'] },
    ],
  }, ChannelRow),
  channel_message: __table({
    name: 'channel_message',
    indexes: [
      { name: 'id', algorithm: 'btree', columns: ['id'] },
    ],
    constraints: [
      { name: 'channel_message_id_key', constraint: 'unique', columns: ['id'] },
    ],
  }, ChannelMessageRow),
  voice_member: __table({
    name: 'voice_member',
    indexes: [
      { name: 'id', algorithm: 'btree', columns: ['id'] },
      { name: 'channel_id', algorithm: 'btree', columns: ['channelId'] },
      { name: 'user_id', algorithm: 'btree', columns: ['userId'] },
      { name: 'identity', algorithm: 'btree', columns: ['identity'] },
    ],
    constraints: [
      { name: 'voice_member_id_key', constraint: 'unique', columns: ['id'] },
    ],
  }, VoiceMemberRow),
  channel_media_settings: __table({
    name: 'channel_media_settings',
    indexes: [
      { name: 'channel_id', algorithm: 'btree', columns: ['channelId'] },
    ],
    constraints: [
      { name: 'channel_media_settings_channel_id_key', constraint: 'unique', columns: ['channelId'] },
    ],
  }, ChannelMediaSettingsRow),
  audio_frame_event: __table({
    name: 'audio_frame_event',
    indexes: [
      { name: 'channel_id', algorithm: 'btree', columns: ['channelId'] },
      { name: 'from', algorithm: 'btree', columns: ['from'] },
    ],
    constraints: [],
  }, AudioFrameEventRow),
  video_frame_event: __table({
    name: 'video_frame_event',
    indexes: [
      { name: 'channel_id', algorithm: 'btree', columns: ['channelId'] },
      { name: 'from', algorithm: 'btree', columns: ['from'] },
    ],
    constraints: [],
  }, VideoFrameEventRow),
});

const reducersSchema = __reducers(
  __reducerSchema("register", RegisterReducer),
  __reducerSchema("login", LoginReducer),
  __reducerSchema("logout", LogoutReducer),
  __reducerSchema("create_server", CreateServerReducer),
  __reducerSchema("delete_server", DeleteServerReducer),
  __reducerSchema("create_invite", CreateInviteReducer),
  __reducerSchema("join_server", JoinServerReducer),
  __reducerSchema("leave_server", LeaveServerReducer),
  __reducerSchema("create_category", CreateCategoryReducer),
  __reducerSchema("delete_category", DeleteCategoryReducer),
  __reducerSchema("create_channel", CreateChannelReducer),
  __reducerSchema("delete_channel", DeleteChannelReducer),
  __reducerSchema("send_channel_message", SendChannelMessageReducer),
  __reducerSchema("delete_message", DeleteMessageReducer),
  __reducerSchema("join_voice_channel", JoinVoiceChannelReducer),
  __reducerSchema("leave_voice_channel", LeaveVoiceChannelReducer),
  __reducerSchema("set_channel_media_settings", SetChannelMediaSettingsReducer),
  __reducerSchema("send_audio_frame", SendAudioFrameReducer),
  __reducerSchema("send_video_frame", SendVideoFrameReducer),
);

const proceduresSchema = __procedures();

const REMOTE_MODULE = {
  versionInfo: {
    cliVersion: "2.0.2" as const,
  },
  tables: tablesSchema.schemaType.tables,
  reducers: reducersSchema.reducersType.reducers,
  ...proceduresSchema,
} satisfies __RemoteModule<
  typeof tablesSchema.schemaType,
  typeof reducersSchema.reducersType,
  typeof proceduresSchema
>;

export const tables: __QueryBuilder<typeof tablesSchema.schemaType> = __makeQueryBuilder(tablesSchema.schemaType);
export const reducers = __convertToAccessorMap(reducersSchema.reducersType.reducers);

export type EventContext = __EventContextInterface<typeof REMOTE_MODULE>;
export type ReducerEventContext = __ReducerEventContextInterface<typeof REMOTE_MODULE>;
export type SubscriptionEventContext = __SubscriptionEventContextInterface<typeof REMOTE_MODULE>;
export type ErrorContext = __ErrorContextInterface<typeof REMOTE_MODULE>;
export type SubscriptionHandle = __SubscriptionHandleImpl<typeof REMOTE_MODULE>;

export class SubscriptionBuilder extends __SubscriptionBuilderImpl<typeof REMOTE_MODULE> {}

export class DbConnectionBuilder extends __DbConnectionBuilder<DbConnection> {}

export class DbConnection extends __DbConnectionImpl<typeof REMOTE_MODULE> {
  static builder = (): DbConnectionBuilder => {
    return new DbConnectionBuilder(REMOTE_MODULE, (config: __DbConnectionConfig<typeof REMOTE_MODULE>) => new DbConnection(config));
  };

  override subscriptionBuilder = (): SubscriptionBuilder => {
    return new SubscriptionBuilder(this);
  };
}
