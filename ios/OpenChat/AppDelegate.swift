import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    configureFirebaseIfPresent()

    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "OpenChat",
      in: window,
      launchOptions: launchOptions
    )

    return true
  }

  /// Push needs Firebase, set up from your own GoogleService-Info.plist (docs/guides/push.md).
  /// Without that file the app runs with push off, so FirebaseApp is configured only when it
  /// is bundled. It is looked up by name: Firebase is linked through React Native Firebase's
  /// Swift package, not this target, and a build without it must still compile.
  private func configureFirebaseIfPresent() {
    guard Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") != nil,
          let firApp = NSClassFromString("FIRApp") as? NSObject.Type else { return }
    _ = firApp.perform(NSSelectorFromString("configure"))
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
