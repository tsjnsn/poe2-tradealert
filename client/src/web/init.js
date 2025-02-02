import { init, events, filesystem, os } from '@neutralinojs/lib';

init();

events.on('ready', () => {
  console.log('Ready');
});


(async () => {
try {
  // method 1
  const storedToken = sessionStorage.getItem('NL_TOKEN');
  if (storedToken) window.NL_TOKEN = storedToken;

  // method 2
  const authInfo = await import('../../.tmp/auth_info.json');
  const { accessToken } = authInfo;
  window.NL_TOKEN = accessToken;

} catch {
  console.error(
    'Auth file not found, native API calls will not work.'
  );
}
})();
  