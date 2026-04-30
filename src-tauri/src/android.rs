#[cfg(target_os = "android")]
use jni::objects::JValue;
    
#[cfg(target_os = "android")]
pub fn android_wake_lock () {
    let ctx = ndk_context::android_context();
    let vm = unsafe { jni::JavaVM::from_raw(ctx.vm().cast()) }.unwrap();
    let mut env = vm.attach_current_thread().unwrap();
    let activity = unsafe { jni::objects::JObject::from_raw(ctx.context().cast()) };

    // WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON = 128
    let flag_keep_screen_on: i32 = 128;

    let window = env.call_method(&activity, "getWindow", "()Landroid/view/Window;", &[]).unwrap().l().unwrap();
    let _ = env.call_method(window, "addFlags", "(I)V", &[flag_keep_screen_on.into()]);
    
    println!("Android: Screen wake lock acquired.");
}
    