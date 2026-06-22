#[cfg(target_os = "macos")]
use cocoa::base::id;

#[cfg(target_os = "macos")]
pub fn set_shadow(window: &tauri::WebviewWindow, enable: bool) {
    use cocoa::base::YES;
    use cocoa::base::NO;
    let ns_window = window.ns_window().unwrap() as id;
    unsafe {
        let _: () = msg_send![ns_window, setHasShadow: if enable { YES } else { NO }];
    }
}

#[cfg(target_os = "macos")]
use tauri::{AppHandle, Emitter};

#[cfg(target_os = "macos")]
pub fn hide_dock_icon() {
    use cocoa::appkit::{NSApplication, NSApplicationActivationPolicyAccessory};
    unsafe {
        let app = NSApplication::sharedApplication(cocoa::base::nil);
        app.setActivationPolicy_(NSApplicationActivationPolicyAccessory);
    }
}

#[cfg(target_os = "macos")]
pub fn force_focus() {
    use cocoa::appkit::NSApplication;
    unsafe {
        let app = NSApplication::sharedApplication(cocoa::base::nil);
        app.activateIgnoringOtherApps_(cocoa::base::YES);
    }
}

#[cfg(target_os = "macos")]
pub fn setup_power_monitor(app_handle: AppHandle) {
    use cocoa::base::{id, nil};
    use cocoa::foundation::NSString;
    use objc::declare::ClassDecl;
    use objc::runtime::{Class, Object, Sel};
    use std::ffi::c_void;

    unsafe {
        let class_name = "PaperCachePowerMonitorDelegate";
        let delegate_class = match Class::get(class_name) {
            Some(cls) => cls,
            None => {
                let superclass = class!(NSObject);
                let mut decl = ClassDecl::new(class_name, superclass).expect("Failed to declare class");

                decl.add_ivar::<*mut c_void>("app_handle");

                extern "C" fn on_sleep(this: &Object, _cmd: Sel, _notification: id) {
                    unsafe {
                        let ptr: *mut c_void = *this.get_ivar("app_handle");
                        let app = &*(ptr as *const AppHandle);
                        let _ = app.emit("power:suspend", ());
                    }
                }

                extern "C" fn on_wake(this: &Object, _cmd: Sel, _notification: id) {
                    unsafe {
                        let ptr: *mut c_void = *this.get_ivar("app_handle");
                        let app = &*(ptr as *const AppHandle);
                        let _ = app.emit("power:resume", ());
                    }
                }

                decl.add_method(sel!(onSleep:), on_sleep as extern "C" fn(&Object, Sel, id));
                decl.add_method(sel!(onWake:), on_wake as extern "C" fn(&Object, Sel, id));

                decl.register()
            }
        };

        let delegate: id = msg_send![delegate_class, new];

        let app_box = Box::new(app_handle);
        let ptr = Box::into_raw(app_box) as *mut c_void;
        (*delegate).set_ivar("app_handle", ptr);

        let workspace: id = msg_send![class!(NSWorkspace), sharedWorkspace];
        let nc: id = msg_send![workspace, notificationCenter];

        let sleep_notification = NSString::alloc(nil).init_str("NSWorkspaceWillSleepNotification");
        let wake_notification = NSString::alloc(nil).init_str("NSWorkspaceDidWakeNotification");

        let _: () = msg_send![nc, addObserver:delegate selector:sel!(onSleep:) name:sleep_notification object:nil];
        let _: () = msg_send![nc, addObserver:delegate selector:sel!(onWake:) name:wake_notification object:nil];
    }
}

#[cfg(target_os = "macos")]
pub fn set_move_to_active_space(window: &tauri::WebviewWindow) {
    use cocoa::appkit::NSWindow;
    use cocoa::appkit::NSWindowCollectionBehavior;
    if let Ok(ns_window) = window.ns_window() {
        unsafe {
            let ns_window = ns_window as cocoa::base::id;
            let mut behavior = ns_window.collectionBehavior();
            behavior |= NSWindowCollectionBehavior::NSWindowCollectionBehaviorMoveToActiveSpace;
            ns_window.setCollectionBehavior_(behavior);
        }
    }
}
