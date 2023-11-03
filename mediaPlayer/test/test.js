	// Include it and extract some methods for convenience
  const server = require('server');
const { render } = require('server/reply');
  const { get, post } = server.router;

  // Launch server with options and a couple of routes
  server({ port: 8080 }, [
	get('/', ctx => render('../index.html')),
	get('/' + new RegExp('.*'), ctx => 'Hello world'),
	post('/', ctx => {
	  console.log(ctx.data);
	  return 'ok';
	})
  ]);