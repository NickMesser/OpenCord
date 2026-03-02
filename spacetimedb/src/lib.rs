use sha2::{Digest, Sha256};
use spacetimedb::{Identity, ReducerContext, SpacetimeType, Table, Timestamp};

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

#[derive(SpacetimeType, Debug, Copy, Clone, PartialEq, Eq)]
pub enum MemberRole {
    Owner,
    Admin,
    Member,
}

#[derive(SpacetimeType, Debug, Copy, Clone, PartialEq, Eq)]
pub enum ChannelType {
    Text,
    Voice,
}

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

#[spacetimedb::table(accessor = user_account, public)]
#[derive(Clone)]
pub struct UserAccount {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    #[unique]
    pub email: String,
    #[unique]
    pub username: String,
    pub password_hash: String,
    pub display_name: String,
    pub avatar_url: String,
    pub created_at: Timestamp,
    #[default(None::<Vec<u8>>)]
    pub public_encryption_key: Option<Vec<u8>>,
    #[default(None::<String>)]
    pub status: Option<String>,
    #[default(0u64)]
    pub avatar_file_id: u64,
    #[default(0u64)]
    pub banner_file_id: u64,
}

const MAX_FILE_SIZE: usize = 10 * 1024 * 1024; // 10 MB

#[spacetimedb::table(accessor = file_upload, public)]
#[derive(Clone)]
pub struct FileUpload {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub uploader_id: u64,
    pub filename: String,
    pub content_type: String,
    pub data: Vec<u8>,
    pub size: u64,
    pub uploaded_at: Timestamp,
}

#[spacetimedb::table(accessor = user_session, public)]
#[derive(Clone)]
pub struct UserSession {
    #[primary_key]
    pub identity: Identity,
    pub user_id: u64,
    pub connected_at: Timestamp,
}

#[spacetimedb::table(accessor = server, public)]
#[derive(Clone)]
pub struct Server {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub name: String,
    pub owner_id: u64,
    pub icon_url: String,
    pub created_at: Timestamp,
}

#[spacetimedb::table(accessor = server_member, public)]
#[derive(Clone)]
pub struct ServerMember {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub server_id: u64,
    pub user_id: u64,
    pub role: MemberRole,
    pub joined_at: Timestamp,
}

#[spacetimedb::table(accessor = invite_link, public)]
#[derive(Clone)]
pub struct InviteLink {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub server_id: u64,
    #[unique]
    pub code: String,
    pub created_by: u64,
    pub max_uses: u32,
    pub uses: u32,
    pub created_at: Timestamp,
}

#[spacetimedb::table(accessor = category, public)]
#[derive(Clone)]
pub struct Category {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub server_id: u64,
    pub name: String,
    pub position: u32,
}

#[spacetimedb::table(accessor = channel, public)]
#[derive(Clone)]
pub struct Channel {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub server_id: u64,
    pub category_id: u64,
    pub name: String,
    pub channel_type: ChannelType,
    pub position: u32,
    pub created_at: Timestamp,
}

#[spacetimedb::table(accessor = channel_message, public)]
#[derive(Clone)]
pub struct ChannelMessage {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub channel_id: u64,
    pub sender_id: u64,
    pub content: String,
    pub sent_at: Timestamp,
}

#[spacetimedb::table(accessor = voice_member, public)]
#[derive(Clone)]
pub struct VoiceMember {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub channel_id: u64,
    pub user_id: u64,
    pub identity: Identity,
    pub joined_at: Timestamp,
    #[default(false)]
    pub muted: bool,
    #[default(false)]
    pub deafened: bool,
    #[default(false)]
    pub video_on: bool,
    #[default(false)]
    pub screen_sharing: bool,
}

#[spacetimedb::table(accessor = channel_media_settings, public)]
#[derive(Clone)]
pub struct ChannelMediaSettings {
    #[primary_key]
    pub channel_id: u64,

    pub audio_target_sample_rate: u32,
    pub audio_frame_ms: u16,
    pub audio_max_frame_bytes: u32,
    pub audio_bitrate_kbps: u32,
    pub audio_talking_rms_threshold: f32,

    pub video_enabled: bool,
    pub video_width: u16,
    pub video_height: u16,
    pub video_fps: u8,
    pub video_jpeg_quality: f32,
    pub video_max_frame_bytes: u32,
}

#[spacetimedb::table(accessor = audio_frame_event, public, event)]
#[derive(Clone)]
pub struct AudioFrameEvent {
    pub channel_id: u64,
    pub from: Identity,
    pub seq: u32,
    pub sample_rate: u32,
    pub channels: u8,
    pub rms: f32,
    pub pcm16le: Vec<u8>,
}

#[spacetimedb::table(accessor = video_frame_event, public, event)]
#[derive(Clone)]
pub struct VideoFrameEvent {
    pub channel_id: u64,
    pub from: Identity,
    pub seq: u32,
    pub width: u16,
    pub height: u16,
    pub jpeg: Vec<u8>,
}

#[spacetimedb::table(accessor = message_reaction, public)]
#[derive(Clone)]
pub struct MessageReaction {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub message_id: u64,
    pub user_id: u64,
    pub emoji: String,
    pub created_at: Timestamp,
}

#[spacetimedb::table(accessor = dm_thread, public)]
#[derive(Clone)]
pub struct DmThread {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    #[unique]
    pub pair_key: String,
    pub user_low_id: u64,
    pub user_high_id: u64,
    pub created_at: Timestamp,
    pub last_message_at: Timestamp,
}

#[spacetimedb::table(accessor = dm_member, public)]
#[derive(Clone)]
pub struct DmMember {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub thread_id: u64,
    pub user_id: u64,
    pub joined_at: Timestamp,
}

#[spacetimedb::table(accessor = dm_message, public)]
#[derive(Clone)]
pub struct DmMessage {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub thread_id: u64,
    pub sender_id: u64,
    pub receiver_id: u64,
    pub sender_ephemeral_pubkey: Vec<u8>,
    pub nonce: Vec<u8>,
    pub ciphertext: Vec<u8>,
    pub sent_at: Timestamp,
}

#[spacetimedb::table(accessor = dm_call_member, public)]
#[derive(Clone)]
pub struct DmCallMember {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub thread_id: u64,
    pub user_id: u64,
    pub identity: Identity,
    pub joined_at: Timestamp,
}

#[spacetimedb::table(accessor = dm_audio_frame_event, public, event)]
#[derive(Clone)]
pub struct DmAudioFrameEvent {
    pub thread_id: u64,
    pub from: Identity,
    pub seq: u32,
    pub sample_rate: u32,
    pub channels: u8,
    pub rms: f32,
    pub pcm16le: Vec<u8>,
}

#[spacetimedb::table(accessor = dm_video_frame_event, public, event)]
#[derive(Clone)]
pub struct DmVideoFrameEvent {
    pub thread_id: u64,
    pub from: Identity,
    pub seq: u32,
    pub width: u16,
    pub height: u16,
    pub jpeg: Vec<u8>,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn hash_password(email: &str, password: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(format!("{}:{}", email.to_lowercase(), password));
    hex::encode(hasher.finalize())
}

fn get_session(ctx: &ReducerContext) -> Result<UserSession, String> {
    ctx.db
        .user_session()
        .identity()
        .find(&ctx.sender())
        .ok_or_else(|| "Not logged in".to_string())
}

fn get_caller(ctx: &ReducerContext) -> Result<UserAccount, String> {
    let session = get_session(ctx)?;
    ctx.db
        .user_account()
        .id()
        .find(&session.user_id)
        .ok_or_else(|| "Account not found".to_string())
}

fn get_member_role(ctx: &ReducerContext, server_id: u64) -> Result<MemberRole, String> {
    let caller = get_caller(ctx)?;
    for m in ctx.db.server_member().iter() {
        if m.server_id == server_id && m.user_id == caller.id {
            return Ok(m.role);
        }
    }
    Err("Not a member of this server".to_string())
}

fn require_admin(ctx: &ReducerContext, server_id: u64) -> Result<UserAccount, String> {
    let caller = get_caller(ctx)?;
    let role = get_member_role(ctx, server_id)?;
    if role != MemberRole::Owner && role != MemberRole::Admin {
        return Err("Insufficient permissions".to_string());
    }
    Ok(caller)
}

fn generate_invite_code(ctx: &ReducerContext) -> String {
    let uuid = ctx
        .new_uuid_v7()
        .or_else(|_| ctx.new_uuid_v4())
        .unwrap_or_else(|_| spacetimedb::Uuid::from_random_bytes_v4([0u8; 16]));
    let bytes = uuid.to_uuid().as_bytes().clone();
    let mut code = String::with_capacity(8);
    const CHARSET: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    for &b in bytes.iter().take(8) {
        code.push(CHARSET[(b as usize) % CHARSET.len()] as char);
    }
    code
}

fn default_channel_media_settings(channel_id: u64) -> ChannelMediaSettings {
    ChannelMediaSettings {
        channel_id,
        audio_target_sample_rate: 16000,
        audio_frame_ms: 50,
        audio_max_frame_bytes: 64000,
        audio_bitrate_kbps: 64,
        audio_talking_rms_threshold: 0.02,
        video_enabled: false,
        video_width: 320,
        video_height: 180,
        video_fps: 5,
        video_jpeg_quality: 0.55,
        video_max_frame_bytes: 512000,
    }
}

fn dm_pair_key(a: u64, b: u64) -> Result<(u64, u64, String), String> {
    if a == b {
        return Err("Cannot create a DM with yourself".to_string());
    }
    let (low, high) = if a < b { (a, b) } else { (b, a) };
    Ok((low, high, format!("{}:{}", low, high)))
}

fn get_dm_thread(ctx: &ReducerContext, thread_id: u64) -> Result<DmThread, String> {
    ctx.db
        .dm_thread()
        .id()
        .find(&thread_id)
        .ok_or_else(|| "DM thread not found".to_string())
}

fn ensure_dm_member(ctx: &ReducerContext, thread_id: u64, user_id: u64) -> Result<(), String> {
    let is_member = ctx
        .db
        .dm_member()
        .iter()
        .any(|m| m.thread_id == thread_id && m.user_id == user_id);
    if !is_member {
        return Err("You are not a participant in this DM".to_string());
    }
    Ok(())
}

fn get_or_create_channel_media_settings(ctx: &ReducerContext, channel_id: u64) -> ChannelMediaSettings {
    if let Some(existing) = ctx.db.channel_media_settings().channel_id().find(&channel_id) {
        return existing.clone();
    }
    ctx.db
        .channel_media_settings()
        .insert(default_channel_media_settings(channel_id))
}

fn validate_channel_media_settings(
    audio_target_sample_rate: u32,
    audio_frame_ms: u16,
    audio_max_frame_bytes: u32,
    audio_bitrate_kbps: u32,
    audio_talking_rms_threshold: f32,
    video_enabled: bool,
    video_width: u16,
    video_height: u16,
    video_fps: u8,
    video_jpeg_quality: f32,
    video_max_frame_bytes: u32,
) -> Result<(), String> {
    if !(8000..=48000).contains(&audio_target_sample_rate) {
        return Err("Audio sample rate must be 8000-48000".to_string());
    }
    if !(10..=100).contains(&audio_frame_ms) {
        return Err("Audio frame ms must be 10-100".to_string());
    }
    if audio_max_frame_bytes < 256 || audio_max_frame_bytes > 256000 {
        return Err("Audio max frame bytes must be 256-256000".to_string());
    }
    if audio_bitrate_kbps < 8 || audio_bitrate_kbps > 512 {
        return Err("Audio bitrate must be 8-512 kbps".to_string());
    }
    if !(0.0..=1.0).contains(&audio_talking_rms_threshold) {
        return Err("RMS threshold must be 0.0-1.0".to_string());
    }
    if video_enabled {
        if video_width == 0 || video_height == 0 {
            return Err("Video size must be > 0".to_string());
        }
        if video_fps == 0 || video_fps > 30 {
            return Err("Video fps must be 1-30".to_string());
        }
        if !(0.05..=1.0).contains(&video_jpeg_quality) {
            return Err("Video JPEG quality must be 0.05-1.0".to_string());
        }
        if video_max_frame_bytes < 1024 || video_max_frame_bytes > 2000000 {
            return Err("Video max frame bytes must be 1024-2000000".to_string());
        }
    }
    Ok(())
}

const SCREEN_SHARE_RESOLUTIONS: &[(u16, u16)] = &[
    (640, 360),
    (960, 540),
    (1280, 720),
];

fn is_screen_share_resolution(width: u16, height: u16) -> bool {
    SCREEN_SHARE_RESOLUTIONS
        .iter()
        .any(|(w, h)| *w == width && *h == height)
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

#[spacetimedb::reducer(init)]
pub fn init(_ctx: &ReducerContext) {}

#[spacetimedb::reducer(client_connected)]
pub fn client_connected(_ctx: &ReducerContext) {}

#[spacetimedb::reducer(client_disconnected)]
pub fn client_disconnected(ctx: &ReducerContext) {
    // Keep UserSession alive so the user stays logged in across page refreshes.
    // The explicit `logout` reducer handles session deletion when intentional.
    let ids: Vec<u64> = ctx
        .db
        .voice_member()
        .iter()
        .filter(|m| m.identity == ctx.sender())
        .map(|m| m.id)
        .collect();
    for id in ids {
        ctx.db.voice_member().id().delete(&id);
    }
    let dm_call_ids: Vec<u64> = ctx
        .db
        .dm_call_member()
        .iter()
        .filter(|m| m.identity == ctx.sender())
        .map(|m| m.id)
        .collect();
    for id in dm_call_ids {
        ctx.db.dm_call_member().id().delete(&id);
    }
}

// ---------------------------------------------------------------------------
// Auth Reducers
// ---------------------------------------------------------------------------

#[spacetimedb::reducer]
pub fn register(ctx: &ReducerContext, email: String, password: String, username: String) -> Result<(), String> {
    let email = email.trim().to_lowercase();
    let username = username.trim().to_string();

    if email.is_empty() || !email.contains('@') {
        return Err("Invalid email".to_string());
    }
    if password.len() < 6 {
        return Err("Password must be at least 6 characters".to_string());
    }
    if username.is_empty() || username.len() > 32 {
        return Err("Username must be 1-32 characters".to_string());
    }

    if ctx.db.user_account().email().find(&email).is_some() {
        return Err("Email already registered".to_string());
    }
    if ctx.db.user_account().username().find(&username).is_some() {
        return Err("Username already taken".to_string());
    }

    let hash = hash_password(&email, &password);
    let now = ctx.timestamp;

    let account = ctx.db.user_account().insert(UserAccount {
        id: 0,
        email,
        username: username.clone(),
        password_hash: hash,
        display_name: username,
        avatar_url: String::new(),
        status: None,
        avatar_file_id: 0,
        banner_file_id: 0,
        created_at: now,
        public_encryption_key: None,
    });

    ctx.db.user_session().identity().delete(&ctx.sender());
    ctx.db.user_session().insert(UserSession {
        identity: ctx.sender(),
        user_id: account.id,
        connected_at: now,
    });

    Ok(())
}

#[spacetimedb::reducer]
pub fn login(ctx: &ReducerContext, email: String, password: String) -> Result<(), String> {
    let email = email.trim().to_lowercase();
    let hash = hash_password(&email, &password);

    let account = ctx
        .db
        .user_account()
        .email()
        .find(&email)
        .ok_or_else(|| "Invalid email or password".to_string())?;

    if account.password_hash != hash {
        return Err("Invalid email or password".to_string());
    }

    ctx.db.user_session().identity().delete(&ctx.sender());
    ctx.db.user_session().insert(UserSession {
        identity: ctx.sender(),
        user_id: account.id,
        connected_at: ctx.timestamp,
    });

    Ok(())
}

#[spacetimedb::reducer]
pub fn logout(ctx: &ReducerContext) -> Result<(), String> {
    ctx.db.user_session().identity().delete(&ctx.sender());
    Ok(())
}

#[spacetimedb::reducer]
pub fn set_public_encryption_key(ctx: &ReducerContext, public_encryption_key: Vec<u8>) -> Result<(), String> {
    if public_encryption_key.len() != 65 {
        return Err("Public encryption key must be 65 bytes".to_string());
    }
    let caller = get_caller(ctx)?;
    ctx.db.user_account().id().update(UserAccount {
        public_encryption_key: Some(public_encryption_key),
        ..caller
    });
    Ok(())
}

// ---------------------------------------------------------------------------
// Profile Reducers
// ---------------------------------------------------------------------------

#[spacetimedb::reducer]
pub fn update_profile(ctx: &ReducerContext, display_name: String, status: String) -> Result<(), String> {
    let caller = get_caller(ctx)?;
    let display_name = display_name.trim().to_string();
    let status = status.trim().to_string();

    if display_name.is_empty() || display_name.len() > 32 {
        return Err("Display name must be 1-32 characters".to_string());
    }
    if status.len() > 128 {
        return Err("Status must be <= 128 characters".to_string());
    }

    let status_opt = if status.is_empty() { None } else { Some(status) };

    ctx.db.user_account().id().update(UserAccount {
        display_name,
        status: status_opt,
        ..caller
    });
    Ok(())
}

#[spacetimedb::reducer]
pub fn update_avatar(ctx: &ReducerContext, file_data: Vec<u8>, content_type: String) -> Result<(), String> {
    let caller = get_caller(ctx)?;

    if file_data.is_empty() {
        return Err("File data cannot be empty".to_string());
    }
    if file_data.len() > MAX_FILE_SIZE {
        return Err(format!("File exceeds {}MB limit", MAX_FILE_SIZE / 1024 / 1024));
    }

    let valid_types = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if !valid_types.contains(&content_type.as_str()) {
        return Err("Avatar must be JPEG, PNG, GIF, or WebP".to_string());
    }

    let old_avatar_id = caller.avatar_file_id;

    let file = ctx.db.file_upload().insert(FileUpload {
        id: 0,
        uploader_id: caller.id,
        filename: format!("avatar_{}", caller.id),
        content_type,
        size: file_data.len() as u64,
        data: file_data,
        uploaded_at: ctx.timestamp,
    });

    ctx.db.user_account().id().update(UserAccount {
        avatar_file_id: file.id,
        ..caller
    });

    if old_avatar_id != 0 {
        ctx.db.file_upload().id().delete(&old_avatar_id);
    }

    Ok(())
}

#[spacetimedb::reducer]
pub fn remove_avatar(ctx: &ReducerContext) -> Result<(), String> {
    let caller = get_caller(ctx)?;
    let old_avatar_id = caller.avatar_file_id;

    ctx.db.user_account().id().update(UserAccount {
        avatar_file_id: 0,
        ..caller
    });

    if old_avatar_id != 0 {
        ctx.db.file_upload().id().delete(&old_avatar_id);
    }

    Ok(())
}

#[spacetimedb::reducer]
pub fn update_banner(ctx: &ReducerContext, file_data: Vec<u8>, content_type: String) -> Result<(), String> {
    let caller = get_caller(ctx)?;

    if file_data.is_empty() {
        return Err("File data cannot be empty".to_string());
    }
    if file_data.len() > MAX_FILE_SIZE {
        return Err(format!("File exceeds {}MB limit", MAX_FILE_SIZE / 1024 / 1024));
    }

    let valid_types = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if !valid_types.contains(&content_type.as_str()) {
        return Err("Banner must be JPEG, PNG, GIF, or WebP".to_string());
    }

    let old_banner_id = caller.banner_file_id;

    let file = ctx.db.file_upload().insert(FileUpload {
        id: 0,
        uploader_id: caller.id,
        filename: format!("banner_{}", caller.id),
        content_type,
        size: file_data.len() as u64,
        data: file_data,
        uploaded_at: ctx.timestamp,
    });

    ctx.db.user_account().id().update(UserAccount {
        banner_file_id: file.id,
        ..caller
    });

    if old_banner_id != 0 {
        ctx.db.file_upload().id().delete(&old_banner_id);
    }

    Ok(())
}

#[spacetimedb::reducer]
pub fn remove_banner(ctx: &ReducerContext) -> Result<(), String> {
    let caller = get_caller(ctx)?;
    let old_banner_id = caller.banner_file_id;

    ctx.db.user_account().id().update(UserAccount {
        banner_file_id: 0,
        ..caller
    });

    if old_banner_id != 0 {
        ctx.db.file_upload().id().delete(&old_banner_id);
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// File Upload Reducers
// ---------------------------------------------------------------------------

#[spacetimedb::reducer]
pub fn upload_file(
    ctx: &ReducerContext,
    filename: String,
    content_type: String,
    data: Vec<u8>,
) -> Result<(), String> {
    let caller = get_caller(ctx)?;
    let filename = filename.trim().to_string();

    if filename.is_empty() || filename.len() > 255 {
        return Err("Filename must be 1-255 characters".to_string());
    }
    if data.is_empty() {
        return Err("File data cannot be empty".to_string());
    }
    if data.len() > MAX_FILE_SIZE {
        return Err(format!("File exceeds {}MB limit", MAX_FILE_SIZE / 1024 / 1024));
    }
    if content_type.is_empty() || content_type.len() > 255 {
        return Err("Invalid content type".to_string());
    }

    ctx.db.file_upload().insert(FileUpload {
        id: 0,
        uploader_id: caller.id,
        filename,
        content_type,
        size: data.len() as u64,
        data,
        uploaded_at: ctx.timestamp,
    });

    Ok(())
}

#[spacetimedb::reducer]
pub fn delete_file(ctx: &ReducerContext, file_id: u64) -> Result<(), String> {
    let caller = get_caller(ctx)?;
    let file = ctx.db.file_upload().id().find(&file_id)
        .ok_or_else(|| "File not found".to_string())?;

    if file.uploader_id != caller.id {
        return Err("You can only delete your own files".to_string());
    }

    for user in ctx.db.user_account().iter() {
        if user.avatar_file_id == file_id {
            return Err("Cannot delete a file in use as an avatar".to_string());
        }
        if user.banner_file_id == file_id {
            return Err("Cannot delete a file in use as a banner".to_string());
        }
    }

    ctx.db.file_upload().id().delete(&file_id);
    Ok(())
}

// ---------------------------------------------------------------------------
// Server Reducers
// ---------------------------------------------------------------------------

#[spacetimedb::reducer]
pub fn create_server(ctx: &ReducerContext, name: String) -> Result<(), String> {
    let caller = get_caller(ctx)?;
    let name = name.trim().to_string();

    if name.is_empty() || name.len() > 100 {
        return Err("Server name must be 1-100 characters".to_string());
    }

    let now = ctx.timestamp;

    let srv = ctx.db.server().insert(Server {
        id: 0,
        name,
        owner_id: caller.id,
        icon_url: String::new(),
        created_at: now,
    });

    ctx.db.server_member().insert(ServerMember {
        id: 0,
        server_id: srv.id,
        user_id: caller.id,
        role: MemberRole::Owner,
        joined_at: now,
    });

    let cat = ctx.db.category().insert(Category {
        id: 0,
        server_id: srv.id,
        name: "General".to_string(),
        position: 0,
    });

    ctx.db.channel().insert(Channel {
        id: 0,
        server_id: srv.id,
        category_id: cat.id,
        name: "general".to_string(),
        channel_type: ChannelType::Text,
        position: 0,
        created_at: now,
    });

    Ok(())
}

#[spacetimedb::reducer]
pub fn delete_server(ctx: &ReducerContext, server_id: u64) -> Result<(), String> {
    let caller = get_caller(ctx)?;
    let srv = ctx.db.server().id().find(&server_id).ok_or("Server not found")?;

    if srv.owner_id != caller.id {
        return Err("Only the owner can delete a server".to_string());
    }

    let member_ids: Vec<u64> = ctx.db.server_member().iter().filter(|m| m.server_id == server_id).map(|m| m.id).collect();
    for mid in member_ids { ctx.db.server_member().id().delete(&mid); }

    let invite_ids: Vec<u64> = ctx.db.invite_link().iter().filter(|i| i.server_id == server_id).map(|i| i.id).collect();
    for iid in invite_ids { ctx.db.invite_link().id().delete(&iid); }

    let cat_ids: Vec<u64> = ctx.db.category().iter().filter(|c| c.server_id == server_id).map(|c| c.id).collect();
    for cid in cat_ids { ctx.db.category().id().delete(&cid); }

    let chan_ids: Vec<u64> = ctx.db.channel().iter().filter(|c| c.server_id == server_id).map(|c| c.id).collect();
    for ch_id in &chan_ids {
        let msg_ids: Vec<u64> = ctx.db.channel_message().iter().filter(|m| m.channel_id == *ch_id).map(|m| m.id).collect();
        for mid in &msg_ids {
            let reaction_ids: Vec<u64> = ctx.db.message_reaction().iter().filter(|r| r.message_id == *mid).map(|r| r.id).collect();
            for rid in reaction_ids { ctx.db.message_reaction().id().delete(&rid); }
        }
        for mid in msg_ids { ctx.db.channel_message().id().delete(&mid); }
        let voice_ids: Vec<u64> = ctx.db.voice_member().iter().filter(|v| v.channel_id == *ch_id).map(|v| v.id).collect();
        for vid in voice_ids { ctx.db.voice_member().id().delete(&vid); }
        ctx.db.channel_media_settings().channel_id().delete(ch_id);
    }
    for ch_id in chan_ids { ctx.db.channel().id().delete(&ch_id); }

    ctx.db.server().id().delete(&server_id);
    Ok(())
}

#[spacetimedb::reducer]
pub fn create_invite(ctx: &ReducerContext, server_id: u64, max_uses: u32) -> Result<(), String> {
    let caller = require_admin(ctx, server_id)?;
    let code = generate_invite_code(ctx);

    ctx.db.invite_link().insert(InviteLink {
        id: 0,
        server_id,
        code,
        created_by: caller.id,
        max_uses,
        uses: 0,
        created_at: ctx.timestamp,
    });

    Ok(())
}

#[spacetimedb::reducer]
pub fn join_server(ctx: &ReducerContext, invite_code: String) -> Result<(), String> {
    let caller = get_caller(ctx)?;
    let invite_code = invite_code.trim().to_string();

    let invite = ctx
        .db
        .invite_link()
        .code()
        .find(&invite_code)
        .ok_or_else(|| "Invalid invite code".to_string())?;

    if invite.max_uses > 0 && invite.uses >= invite.max_uses {
        return Err("Invite has expired".to_string());
    }

    for m in ctx.db.server_member().iter() {
        if m.server_id == invite.server_id && m.user_id == caller.id {
            return Err("Already a member of this server".to_string());
        }
    }

    let mut updated_invite = invite.clone();
    updated_invite.uses += 1;
    ctx.db.invite_link().id().update(updated_invite);

    ctx.db.server_member().insert(ServerMember {
        id: 0,
        server_id: invite.server_id,
        user_id: caller.id,
        role: MemberRole::Member,
        joined_at: ctx.timestamp,
    });

    Ok(())
}

#[spacetimedb::reducer]
pub fn leave_server(ctx: &ReducerContext, server_id: u64) -> Result<(), String> {
    let caller = get_caller(ctx)?;
    let srv = ctx.db.server().id().find(&server_id).ok_or("Server not found")?;

    if srv.owner_id == caller.id {
        return Err("Owner cannot leave their server (delete it instead)".to_string());
    }

    let member = ctx.db.server_member().iter()
        .find(|m| m.server_id == server_id && m.user_id == caller.id)
        .ok_or("Not a member")?;

    ctx.db.server_member().id().delete(&member.id);
    let voice_ids: Vec<u64> = ctx
        .db
        .voice_member()
        .iter()
        .filter(|v| v.user_id == caller.id)
        .filter(|v| {
            ctx.db
                .channel()
                .id()
                .find(&v.channel_id)
                .map(|ch| ch.server_id == server_id)
                .unwrap_or(false)
        })
        .map(|v| v.id)
        .collect();
    for vid in voice_ids {
        ctx.db.voice_member().id().delete(&vid);
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Category / Channel Reducers
// ---------------------------------------------------------------------------

#[spacetimedb::reducer]
pub fn create_category(ctx: &ReducerContext, server_id: u64, name: String) -> Result<(), String> {
    require_admin(ctx, server_id)?;
    let name = name.trim().to_string();

    if name.is_empty() || name.len() > 100 {
        return Err("Category name must be 1-100 characters".to_string());
    }

    let position = ctx.db.category().iter().filter(|c| c.server_id == server_id).count() as u32;

    ctx.db.category().insert(Category {
        id: 0,
        server_id,
        name,
        position,
    });

    Ok(())
}

#[spacetimedb::reducer]
pub fn delete_category(ctx: &ReducerContext, category_id: u64) -> Result<(), String> {
    let cat = ctx.db.category().id().find(&category_id).ok_or("Category not found")?;
    require_admin(ctx, cat.server_id)?;

    let chan_ids: Vec<u64> = ctx.db.channel().iter()
        .filter(|c| c.category_id == category_id)
        .map(|c| c.id)
        .collect();

    for ch_id in chan_ids {
        let mut ch = ctx.db.channel().id().find(&ch_id).unwrap();
        ch.category_id = 0;
        ctx.db.channel().id().update(ch);
    }

    ctx.db.category().id().delete(&category_id);
    Ok(())
}

#[spacetimedb::reducer]
pub fn create_channel(
    ctx: &ReducerContext,
    server_id: u64,
    category_id: u64,
    name: String,
    channel_type: ChannelType,
) -> Result<(), String> {
    require_admin(ctx, server_id)?;
    let name = name.trim().to_lowercase().replace(' ', "-");

    if name.is_empty() || name.len() > 100 {
        return Err("Channel name must be 1-100 characters".to_string());
    }

    if category_id != 0 {
        let cat = ctx.db.category().id().find(&category_id).ok_or("Category not found")?;
        if cat.server_id != server_id {
            return Err("Category does not belong to this server".to_string());
        }
    }

    let position = ctx.db.channel().iter()
        .filter(|c| c.server_id == server_id && c.category_id == category_id)
        .count() as u32;

    let ch = ctx.db.channel().insert(Channel {
        id: 0,
        server_id,
        category_id,
        name,
        channel_type,
        position,
        created_at: ctx.timestamp,
    });
    if ch.channel_type == ChannelType::Voice {
        get_or_create_channel_media_settings(ctx, ch.id);
    }

    Ok(())
}

#[spacetimedb::reducer]
pub fn delete_channel(ctx: &ReducerContext, channel_id: u64) -> Result<(), String> {
    let ch = ctx.db.channel().id().find(&channel_id).ok_or("Channel not found")?;
    require_admin(ctx, ch.server_id)?;

    let msg_ids: Vec<u64> = ctx.db.channel_message().iter()
        .filter(|m| m.channel_id == channel_id)
        .map(|m| m.id)
        .collect();
    for mid in &msg_ids {
        let reaction_ids: Vec<u64> = ctx.db.message_reaction().iter()
            .filter(|r| r.message_id == *mid)
            .map(|r| r.id)
            .collect();
        for rid in reaction_ids {
            ctx.db.message_reaction().id().delete(&rid);
        }
    }
    for mid in msg_ids {
        ctx.db.channel_message().id().delete(&mid);
    }
    let voice_ids: Vec<u64> = ctx.db.voice_member().iter()
        .filter(|v| v.channel_id == channel_id)
        .map(|v| v.id)
        .collect();
    for vid in voice_ids {
        ctx.db.voice_member().id().delete(&vid);
    }
    ctx.db.channel_media_settings().channel_id().delete(&channel_id);

    ctx.db.channel().id().delete(&channel_id);
    Ok(())
}

// ---------------------------------------------------------------------------
// Voice Reducers
// ---------------------------------------------------------------------------

#[spacetimedb::reducer]
pub fn join_voice_channel(ctx: &ReducerContext, channel_id: u64) -> Result<(), String> {
    let caller = get_caller(ctx)?;
    let ch = ctx.db.channel().id().find(&channel_id).ok_or("Channel not found")?;
    if ch.channel_type != ChannelType::Voice {
        return Err("Not a voice channel".to_string());
    }

    let is_member = ctx.db.server_member().iter()
        .any(|m| m.server_id == ch.server_id && m.user_id == caller.id);
    if !is_member {
        return Err("Not a member of this server".to_string());
    }

    let existing: Vec<u64> = ctx.db.voice_member().iter()
        .filter(|v| v.identity == ctx.sender())
        .map(|v| v.id)
        .collect();
    for id in existing {
        ctx.db.voice_member().id().delete(&id);
    }

    get_or_create_channel_media_settings(ctx, channel_id);

    ctx.db.voice_member().insert(VoiceMember {
        id: 0,
        channel_id,
        user_id: caller.id,
        identity: ctx.sender(),
        joined_at: ctx.timestamp,
        muted: false,
        deafened: false,
        video_on: false,
        screen_sharing: false,
    });
    Ok(())
}

#[spacetimedb::reducer]
pub fn leave_voice_channel(ctx: &ReducerContext, channel_id: u64) -> Result<(), String> {
    let ids: Vec<u64> = ctx.db.voice_member().iter()
        .filter(|v| v.identity == ctx.sender() && v.channel_id == channel_id)
        .map(|v| v.id)
        .collect();
    for id in ids {
        ctx.db.voice_member().id().delete(&id);
    }
    Ok(())
}

#[spacetimedb::reducer]
pub fn kick_from_voice(ctx: &ReducerContext, channel_id: u64, target_user_id: u64) -> Result<(), String> {
    let ch = ctx.db.channel().id().find(&channel_id)
        .ok_or("Channel not found")?;
    require_admin(ctx, ch.server_id)?;

    let caller = get_caller(ctx)?;
    if caller.id == target_user_id {
        return Err("Cannot kick yourself".to_string());
    }

    let ids: Vec<u64> = ctx.db.voice_member().iter()
        .filter(|v| v.user_id == target_user_id && v.channel_id == channel_id)
        .map(|v| v.id)
        .collect();
    if ids.is_empty() {
        return Err("User is not in this voice channel".to_string());
    }
    for id in ids {
        ctx.db.voice_member().id().delete(&id);
    }
    Ok(())
}

#[spacetimedb::reducer]
pub fn update_voice_state(
    ctx: &ReducerContext,
    channel_id: u64,
    muted: bool,
    deafened: bool,
    video_on: bool,
    screen_sharing: bool,
) -> Result<(), String> {
    let who = ctx.sender();
    let member = ctx
        .db
        .voice_member()
        .iter()
        .find(|v| v.identity == who && v.channel_id == channel_id)
        .ok_or("Not in this voice channel")?;

    ctx.db.voice_member().id().update(VoiceMember {
        muted,
        deafened,
        video_on,
        screen_sharing,
        ..member
    });
    Ok(())
}

#[spacetimedb::reducer]
pub fn set_channel_media_settings(
    ctx: &ReducerContext,
    channel_id: u64,
    audio_target_sample_rate: u32,
    audio_frame_ms: u16,
    audio_max_frame_bytes: u32,
    audio_bitrate_kbps: u32,
    audio_talking_rms_threshold: f32,
    video_enabled: bool,
    video_width: u16,
    video_height: u16,
    video_fps: u8,
    video_jpeg_quality: f32,
    video_max_frame_bytes: u32,
) -> Result<(), String> {
    let ch = ctx.db.channel().id().find(&channel_id).ok_or("Channel not found")?;
    if ch.channel_type != ChannelType::Voice {
        return Err("Not a voice channel".to_string());
    }
    require_admin(ctx, ch.server_id)?;

    validate_channel_media_settings(
        audio_target_sample_rate,
        audio_frame_ms,
        audio_max_frame_bytes,
        audio_bitrate_kbps,
        audio_talking_rms_threshold,
        video_enabled,
        video_width,
        video_height,
        video_fps,
        video_jpeg_quality,
        video_max_frame_bytes,
    )?;

    let row = ChannelMediaSettings {
        channel_id,
        audio_target_sample_rate,
        audio_frame_ms,
        audio_max_frame_bytes,
        audio_bitrate_kbps,
        audio_talking_rms_threshold,
        video_enabled,
        video_width,
        video_height,
        video_fps,
        video_jpeg_quality,
        video_max_frame_bytes,
    };

    if ctx.db.channel_media_settings().channel_id().find(&channel_id).is_some() {
        ctx.db.channel_media_settings().channel_id().update(row);
    } else {
        ctx.db.channel_media_settings().insert(row);
    }
    Ok(())
}

#[spacetimedb::reducer]
pub fn send_audio_frame(
    ctx: &ReducerContext,
    channel_id: u64,
    seq: u32,
    sample_rate: u32,
    channels: u8,
    rms: f32,
    pcm16le: Vec<u8>,
) -> Result<(), String> {
    let who = ctx.sender();
    let is_in = ctx.db.voice_member().iter()
        .any(|v| v.identity == who && v.channel_id == channel_id);
    if !is_in {
        return Err("Not in voice channel".to_string());
    }

    let settings = get_or_create_channel_media_settings(ctx, channel_id);
    if sample_rate != settings.audio_target_sample_rate {
        return Err("Sample rate mismatch".to_string());
    }
    if channels == 0 || channels > 2 {
        return Err("Invalid channel count".to_string());
    }
    if pcm16le.len() > settings.audio_max_frame_bytes as usize {
        return Err("Audio frame too large".to_string());
    }

    ctx.db.audio_frame_event().insert(AudioFrameEvent {
        channel_id,
        from: who,
        seq,
        sample_rate,
        channels,
        rms,
        pcm16le,
    });
    Ok(())
}

#[spacetimedb::reducer]
pub fn send_video_frame(
    ctx: &ReducerContext,
    channel_id: u64,
    seq: u32,
    width: u16,
    height: u16,
    jpeg: Vec<u8>,
) -> Result<(), String> {
    let who = ctx.sender();
    let is_in = ctx.db.voice_member().iter()
        .any(|v| v.identity == who && v.channel_id == channel_id);
    if !is_in {
        return Err("Not in voice channel".to_string());
    }

    let ch = ctx.db.channel().id().find(&channel_id).ok_or("Channel not found")?;
    if ch.channel_type != ChannelType::Voice {
        return Err("Not a voice channel".to_string());
    }

    let settings = get_or_create_channel_media_settings(ctx, channel_id);
    let is_screen_share = is_screen_share_resolution(width, height);
    if !settings.video_enabled && !is_screen_share {
        return Err("Video disabled for channel".to_string());
    }
    if !is_screen_share && (width != settings.video_width || height != settings.video_height) {
        return Err("Video size mismatch".to_string());
    }
    if jpeg.len() > settings.video_max_frame_bytes as usize {
        return Err("Video frame too large".to_string());
    }

    ctx.db.video_frame_event().insert(VideoFrameEvent {
        channel_id,
        from: who,
        seq,
        width,
        height,
        jpeg,
    });
    Ok(())
}

// ---------------------------------------------------------------------------
// Message Reducers
// ---------------------------------------------------------------------------

#[spacetimedb::reducer]
pub fn send_channel_message(ctx: &ReducerContext, channel_id: u64, content: String) -> Result<(), String> {
    let caller = get_caller(ctx)?;
    let content = content.trim().to_string();

    if content.is_empty() {
        return Err("Message cannot be empty".to_string());
    }
    if content.len() > 2000 {
        return Err("Message must be <= 2000 characters".to_string());
    }

    let ch = ctx.db.channel().id().find(&channel_id).ok_or("Channel not found")?;

    let is_member = ctx.db.server_member().iter()
        .any(|m| m.server_id == ch.server_id && m.user_id == caller.id);
    if !is_member {
        return Err("Not a member of this server".to_string());
    }

    ctx.db.channel_message().insert(ChannelMessage {
        id: 0,
        channel_id,
        sender_id: caller.id,
        content,
        sent_at: ctx.timestamp,
    });

    Ok(())
}

#[spacetimedb::reducer]
pub fn delete_message(ctx: &ReducerContext, message_id: u64) -> Result<(), String> {
    let caller = get_caller(ctx)?;
    let msg = ctx.db.channel_message().id().find(&message_id).ok_or("Message not found")?;
    let ch = ctx.db.channel().id().find(&msg.channel_id).ok_or("Channel not found")?;

    if msg.sender_id != caller.id {
        let role = get_member_role(ctx, ch.server_id)?;
        if role != MemberRole::Owner && role != MemberRole::Admin {
            return Err("Cannot delete another user's message".to_string());
        }
    }

    let reaction_ids: Vec<u64> = ctx.db.message_reaction().iter()
        .filter(|r| r.message_id == message_id)
        .map(|r| r.id)
        .collect();
    for rid in reaction_ids {
        ctx.db.message_reaction().id().delete(&rid);
    }

    ctx.db.channel_message().id().delete(&message_id);
    Ok(())
}

#[spacetimedb::reducer]
pub fn add_reaction(ctx: &ReducerContext, message_id: u64, emoji: String) -> Result<(), String> {
    let caller = get_caller(ctx)?;
    let emoji = emoji.trim().to_string();

    if emoji.is_empty() || emoji.len() > 32 {
        return Err("Invalid emoji".to_string());
    }

    let msg = ctx.db.channel_message().id().find(&message_id)
        .ok_or_else(|| "Message not found".to_string())?;
    let ch = ctx.db.channel().id().find(&msg.channel_id)
        .ok_or_else(|| "Channel not found".to_string())?;

    let is_member = ctx.db.server_member().iter()
        .any(|m| m.server_id == ch.server_id && m.user_id == caller.id);
    if !is_member {
        return Err("Not a member of this server".to_string());
    }

    let already = ctx.db.message_reaction().iter()
        .any(|r| r.message_id == message_id && r.user_id == caller.id && r.emoji == emoji);
    if already {
        return Err("Already reacted with this emoji".to_string());
    }

    ctx.db.message_reaction().insert(MessageReaction {
        id: 0,
        message_id,
        user_id: caller.id,
        emoji,
        created_at: ctx.timestamp,
    });

    Ok(())
}

#[spacetimedb::reducer]
pub fn remove_reaction(ctx: &ReducerContext, message_id: u64, emoji: String) -> Result<(), String> {
    let caller = get_caller(ctx)?;
    let emoji = emoji.trim().to_string();

    let reaction = ctx.db.message_reaction().iter()
        .find(|r| r.message_id == message_id && r.user_id == caller.id && r.emoji == emoji)
        .ok_or_else(|| "Reaction not found".to_string())?;

    ctx.db.message_reaction().id().delete(&reaction.id);
    Ok(())
}

// ---------------------------------------------------------------------------
// Private DM Reducers
// ---------------------------------------------------------------------------

#[spacetimedb::reducer]
pub fn open_dm_thread(ctx: &ReducerContext, target_user_id: u64) -> Result<(), String> {
    let caller = get_caller(ctx)?;
    let _target = ctx
        .db
        .user_account()
        .id()
        .find(&target_user_id)
        .ok_or_else(|| "Target user not found".to_string())?;

    let (low, high, pair_key) = dm_pair_key(caller.id, target_user_id)?;
    if ctx.db.dm_thread().pair_key().find(&pair_key).is_some() {
        return Ok(());
    }

    let now = ctx.timestamp;
    let thread = ctx.db.dm_thread().insert(DmThread {
        id: 0,
        pair_key,
        user_low_id: low,
        user_high_id: high,
        created_at: now,
        last_message_at: now,
    });

    ctx.db.dm_member().insert(DmMember {
        id: 0,
        thread_id: thread.id,
        user_id: low,
        joined_at: now,
    });
    ctx.db.dm_member().insert(DmMember {
        id: 0,
        thread_id: thread.id,
        user_id: high,
        joined_at: now,
    });
    Ok(())
}

#[spacetimedb::reducer]
pub fn send_dm_message(
    ctx: &ReducerContext,
    thread_id: u64,
    receiver_user_id: u64,
    sender_ephemeral_pubkey: Vec<u8>,
    nonce: Vec<u8>,
    ciphertext: Vec<u8>,
) -> Result<(), String> {
    let caller = get_caller(ctx)?;
    let thread = get_dm_thread(ctx, thread_id)?;
    ensure_dm_member(ctx, thread.id, caller.id)?;
    ensure_dm_member(ctx, thread.id, receiver_user_id)?;

    if caller.id == receiver_user_id {
        return Err("Cannot send a DM to yourself".to_string());
    }
    if sender_ephemeral_pubkey.len() != 65 {
        return Err("Sender ephemeral public key must be 65 bytes".to_string());
    }
    if nonce.len() != 12 {
        return Err("Nonce must be 12 bytes".to_string());
    }
    if ciphertext.is_empty() {
        return Err("Ciphertext cannot be empty".to_string());
    }
    if ciphertext.len() > 32768 {
        return Err("Ciphertext too large".to_string());
    }

    ctx.db.dm_message().insert(DmMessage {
        id: 0,
        thread_id: thread.id,
        sender_id: caller.id,
        receiver_id: receiver_user_id,
        sender_ephemeral_pubkey,
        nonce,
        ciphertext,
        sent_at: ctx.timestamp,
    });

    ctx.db.dm_thread().id().update(DmThread {
        last_message_at: ctx.timestamp,
        ..thread
    });
    Ok(())
}

#[spacetimedb::reducer]
pub fn delete_dm_message(ctx: &ReducerContext, message_id: u64) -> Result<(), String> {
    let caller = get_caller(ctx)?;
    let msg = ctx
        .db
        .dm_message()
        .id()
        .find(&message_id)
        .ok_or_else(|| "DM message not found".to_string())?;
    ensure_dm_member(ctx, msg.thread_id, caller.id)?;
    if msg.sender_id != caller.id {
        return Err("Only the sender can delete this DM".to_string());
    }
    ctx.db.dm_message().id().delete(&message_id);
    Ok(())
}

#[spacetimedb::reducer]
pub fn join_dm_call(ctx: &ReducerContext, thread_id: u64) -> Result<(), String> {
    let caller = get_caller(ctx)?;
    get_dm_thread(ctx, thread_id)?;
    ensure_dm_member(ctx, thread_id, caller.id)?;

    let existing: Vec<u64> = ctx
        .db
        .dm_call_member()
        .iter()
        .filter(|m| m.identity == ctx.sender())
        .map(|m| m.id)
        .collect();
    for id in existing {
        ctx.db.dm_call_member().id().delete(&id);
    }

    ctx.db.dm_call_member().insert(DmCallMember {
        id: 0,
        thread_id,
        user_id: caller.id,
        identity: ctx.sender(),
        joined_at: ctx.timestamp,
    });
    Ok(())
}

#[spacetimedb::reducer]
pub fn leave_dm_call(ctx: &ReducerContext, thread_id: u64) -> Result<(), String> {
    let ids: Vec<u64> = ctx
        .db
        .dm_call_member()
        .iter()
        .filter(|m| m.identity == ctx.sender() && m.thread_id == thread_id)
        .map(|m| m.id)
        .collect();
    for id in ids {
        ctx.db.dm_call_member().id().delete(&id);
    }
    Ok(())
}

#[spacetimedb::reducer]
pub fn send_dm_audio_frame(
    ctx: &ReducerContext,
    thread_id: u64,
    seq: u32,
    sample_rate: u32,
    channels: u8,
    rms: f32,
    pcm16le: Vec<u8>,
) -> Result<(), String> {
    let who = ctx.sender();
    let is_in = ctx
        .db
        .dm_call_member()
        .iter()
        .any(|v| v.identity == who && v.thread_id == thread_id);
    if !is_in {
        return Err("Not in DM call".to_string());
    }

    if !(8000..=48000).contains(&sample_rate) {
        return Err("Audio sample rate must be 8000-48000".to_string());
    }
    if channels == 0 || channels > 2 {
        return Err("Invalid channel count".to_string());
    }
    if pcm16le.len() > 64000 {
        return Err("Audio frame too large".to_string());
    }

    ctx.db.dm_audio_frame_event().insert(DmAudioFrameEvent {
        thread_id,
        from: who,
        seq,
        sample_rate,
        channels,
        rms,
        pcm16le,
    });
    Ok(())
}

#[spacetimedb::reducer]
pub fn send_dm_video_frame(
    ctx: &ReducerContext,
    thread_id: u64,
    seq: u32,
    width: u16,
    height: u16,
    jpeg: Vec<u8>,
) -> Result<(), String> {
    let who = ctx.sender();
    let is_in = ctx
        .db
        .dm_call_member()
        .iter()
        .any(|v| v.identity == who && v.thread_id == thread_id);
    if !is_in {
        return Err("Not in DM call".to_string());
    }

    if width == 0 || height == 0 {
        return Err("Video size must be > 0".to_string());
    }
    if jpeg.is_empty() || jpeg.len() > 700000 {
        return Err("Video frame too large".to_string());
    }

    ctx.db.dm_video_frame_event().insert(DmVideoFrameEvent {
        thread_id,
        from: who,
        seq,
        width,
        height,
        jpeg,
    });
    Ok(())
}
