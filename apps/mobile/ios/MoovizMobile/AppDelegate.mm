#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>
#import <GoogleMaps/GoogleMaps.h>
#import <FirebaseCore/FirebaseCore.h>

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  // Firebase must be configured before any other Firebase SDK usage
  [FIRApp configure];

  // Google Maps SDK initialization
  NSString *mapsKey = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"GOOGLE_MAPS_API_KEY"];
  if (mapsKey) {
    [GMSServices provideAPIKey:mapsKey];
  }

  self.moduleName = @"MoovizMobile";
  self.initialProps = @{};

  return [super application:application didFinishLaunchingWithOptions:launchOptions];
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self bundleURL];
}

- (NSURL *)bundleURL
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

@end
