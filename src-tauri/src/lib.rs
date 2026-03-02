use serde::Serialize;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Runtime,
};

#[derive(Debug, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct OgData {
    pub url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub site_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub favicon: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub price: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub theme_color: Option<String>,
}

static BROWSER_UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

fn extract_meta_tag(html: &str, property: &str) -> Option<String> {
    let patterns = [
        format!(
            r#"property="{p}"[^>]*content="([^"]*)""#,
            p = property
        ),
        format!(
            r#"name="{p}"[^>]*content="([^"]*)""#,
            p = property
        ),
        format!(
            r#"content="([^"]*)"[^>]*property="{p}""#,
            p = property
        ),
        format!(
            r#"content="([^"]*)"[^>]*name="{p}""#,
            p = property
        ),
        format!(
            r#"property='{p}'[^>]*content='([^']*)'"#,
            p = property
        ),
        format!(
            r#"name='{p}'[^>]*content='([^']*)'"#,
            p = property
        ),
    ];

    for pat in &patterns {
        if let Ok(re) = regex::Regex::new(pat) {
            if let Some(caps) = re.captures(html) {
                if let Some(m) = caps.get(1) {
                    let val = m.as_str().to_string();
                    if !val.is_empty() {
                        return Some(html_escape_decode(&val));
                    }
                }
            }
        }
    }
    None
}

fn html_escape_decode(s: &str) -> String {
    s.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&#x27;", "'")
}

fn extract_og_data(html: &str, origin: &str) -> OgData {
    let mut data = OgData {
        url: origin.to_string(),
        ..Default::default()
    };

    data.title = extract_meta_tag(html, "og:title")
        .or_else(|| extract_meta_tag(html, "twitter:title"));
    if data.title.is_none() {
        if let Ok(re) = regex::Regex::new(r"(?i)<title[^>]*>([^<]*)</title>") {
            if let Some(caps) = re.captures(html) {
                data.title = caps.get(1).map(|m| html_escape_decode(m.as_str().trim()));
            }
        }
    }

    data.description = extract_meta_tag(html, "og:description")
        .or_else(|| extract_meta_tag(html, "twitter:description"))
        .or_else(|| extract_meta_tag(html, "description"));

    data.image = extract_meta_tag(html, "og:image")
        .or_else(|| extract_meta_tag(html, "twitter:image"))
        .or_else(|| extract_meta_tag(html, "twitter:image:src"));

    data.site_name = extract_meta_tag(html, "og:site_name");
    data.theme_color = extract_meta_tag(html, "theme-color");

    if let Some(ref img) = data.image {
        if !img.starts_with("http") {
            if let Ok(base) = url::Url::parse(origin) {
                if let Ok(abs) = base.join(img) {
                    data.image = Some(abs.to_string());
                }
            }
        }
    }

    if let Ok(u) = url::Url::parse(origin) {
        data.favicon = Some(format!("{}/favicon.ico", u.origin().ascii_serialization()));
    }

    let icon_re = regex::Regex::new(
        r#"(?i)<link[^>]*rel=["'](?:icon|shortcut icon|apple-touch-icon)["'][^>]*href=["']([^"']*)["']"#,
    );
    if let Ok(re) = icon_re {
        if let Some(caps) = re.captures(html) {
            if let Some(href) = caps.get(1) {
                if let Ok(base) = url::Url::parse(origin) {
                    if let Ok(abs) = base.join(href.as_str()) {
                        data.favicon = Some(abs.to_string());
                    }
                }
            }
        }
    }

    if origin.contains("store.steampowered.com") {
        let price_re = regex::Regex::new(
            r#"(?i)<div class="(?:game_purchase_price|discount_final_price)[^"]*"[^>]*>([^<]*)</div>"#,
        );
        if let Ok(re) = price_re {
            if let Some(caps) = re.captures(html) {
                data.price = caps.get(1).map(|m| m.as_str().trim().to_string());
            }
        }
    }

    data
}

#[tauri::command]
async fn link_preview(target_url: String) -> Result<OgData, String> {
    let parsed = url::Url::parse(&target_url).map_err(|e| format!("Invalid URL: {e}"))?;
    let scheme = parsed.scheme();
    if scheme != "http" && scheme != "https" {
        return Err("Protocol not allowed".to_string());
    }

    let client = reqwest::Client::builder()
        .user_agent(BROWSER_UA)
        .timeout(std::time::Duration::from_secs(12))
        .redirect(reqwest::redirect::Policy::limited(10))
        .build()
        .map_err(|e| format!("HTTP client error: {e}"))?;

    let mut req = client
        .get(&target_url)
        .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
        .header("Accept-Language", "en-US,en;q=0.9")
        .header("Cache-Control", "no-cache");

    if target_url.contains("store.steampowered.com") {
        req = req.header(
            "Cookie",
            "birthtime=0; wants_mature_content=1; lastagecheckage=1-0-2000; Steam_Language=english",
        );
    }

    let resp = req.send().await.map_err(|e| {
        if e.is_timeout() {
            "Request timed out".to_string()
        } else {
            format!("Failed to fetch URL: {e}")
        }
    })?;

    if !resp.status().is_success() {
        return Err(format!("Upstream returned {}", resp.status()));
    }

    let content_type = resp
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    if !content_type.contains("text/html") && !content_type.contains("application/xhtml") {
        return Err("Not an HTML page".to_string());
    }

    let body = resp.text().await.map_err(|e| format!("Read error: {e}"))?;
    let html = if body.len() > 512_000 {
        &body[..512_000]
    } else {
        &body
    };

    let data = extract_og_data(html, &target_url);

    if data.title.is_none() && data.description.is_none() && data.image.is_none() {
        return Err("No metadata found".to_string());
    }

    Ok(data)
}

fn toggle_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

fn show_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .invoke_handler(tauri::generate_handler![link_preview])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let show_hide = MenuItem::with_id(app, "show_hide", "Show/Hide", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_hide, &quit])?;

            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("OpenCord")
                .on_menu_event(|app_handle, event| match event.id.as_ref() {
                    "show_hide" => toggle_window(app_handle),
                    "quit" => app_handle.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray_icon, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_window(tray_icon.app_handle());
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
