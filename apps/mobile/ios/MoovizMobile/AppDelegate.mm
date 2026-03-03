#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>
#import <GoogleMaps/GoogleMaps.h>

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  // Google Maps SDK initialization
  // The API key is loaded from .env via react-native-config at build time.
  // For development, set GOOGLE_MAPS_API_KEY in .env.dev
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
