"""Serve this extracted game locally. Python standard library only."""
import functools
import http.server
import pathlib
import sys
import webbrowser

root = pathlib.Path(__file__).resolve().parent
port = next((int(arg[7:]) for arg in sys.argv if arg.startswith('--port=')), 8897)
class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      '.js': 'text/javascript', '.mjs': 'text/javascript',
                      '.gltf': 'model/gltf+json', '.webmanifest': 'application/manifest+json'}
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
    def log_message(self, *args):
        pass

try:
    with http.server.ThreadingHTTPServer(('127.0.0.1', port), functools.partial(Handler, directory=str(root))) as server:
        url = 'http://127.0.0.1:%d/play.html' % server.server_port
        print('Forest Echoes NEXT: ' + url, flush=True)
        print('Keep this window open. Press Ctrl+C to stop.', flush=True)
        if '--no-open' not in sys.argv:
            webbrowser.open(url)
        server.serve_forever()
except KeyboardInterrupt:
    pass
except OSError as error:
    print('Could not start the local server. Close the previous game server and retry.\n' + str(error), file=sys.stderr)
    sys.exit(1)
