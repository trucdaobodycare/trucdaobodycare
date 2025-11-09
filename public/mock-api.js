
// mock-api.js -- client-side mock server for /api/* endpoints and common login/admin targets
(function(){
  function jsonResponse(obj, status=200){
    return Promise.resolve(new Response(JSON.stringify(obj), {
      status: status,
      headers: {'Content-Type':'application/json'}
    }));
  }

  // Simple in-memory "users"
  const users = [{id:1, username:'admin', password:'admin'}];

  // Helper to parse body if JSON
  async function parseBody(req){
    try{
      const text = await req.text();
      if(!text) return null;
      return JSON.parse(text);
    }catch(e){
      return null;
    }
  }

  const origFetch = window.fetch;
  window.fetch = async function(input, init){
    const url = (typeof input === 'string') ? input : input.url;
    // If relative path, normalize
    const u = url.split('?')[0];
    if(u.match(/^\/?api\/|\.php$/i) || u.match(/\/admin/i)){
      console.log('mock-api intercept:', url);
      // Handle login endpoint examples: /api/login, /login.php, /admin/login
      if(u.match(/login/i)){
        const body = init && init.body ? (typeof init.body === 'string' ? JSON.parse(init.body) : init.body) : null;
        const username = (body && (body.username||body.user)) || (new URLSearchParams(body)).get && (new URLSearchParams(body)).get('username');
        const password = (body && (body.password||body.pass)) || (new URLSearchParams(body)).get && (new URLSearchParams(body)).get('password');
        // simple check
        if(username === 'admin' && password === 'admin'){
          return jsonResponse({ok:true, user:{id:1,username:'admin'}, token:'FAKE-JWT-TOKEN'});
        } else {
          return jsonResponse({ok:false, message:'Invalid credentials (mock). Try admin/admin'}, 401);
        }
      }
      // Generic API list endpoint
      if(u.match(/\/api\/items/i) || u.match(/\/api\/users/i) || u.match(/\/api\/.*/i)){
        return jsonResponse({ok:true, data: [], mock: true});
      }
      // Fallback mock
      return jsonResponse({ok:true, message:'Mock response for '+url});
    }
    // Otherwise call real fetch (if online)
    return origFetch.apply(this, arguments);
  };

  // Also attach window.mockApi so dev can call helpers
  window.mockApi = {
    users: users,
    reset: function(){ users.length = 1; },
    addUser: function(u){ users.push(u); }
  };

  // Provide a visual indicator that mock is active
  document.addEventListener('DOMContentLoaded', function(){
    var b = document.createElement('div');
    b.id = 'mock-indicator';
    b.style.position='fixed';
    b.style.right='10px';
    b.style.bottom='10px';
    b.style.padding='6px 10px';
    b.style.borderRadius='8px';
    b.style.background='rgba(0,0,0,0.6)';
    b.style.color='white';
    b.style.fontSize='12px';
    b.style.zIndex='99999';
    b.textContent='Mock API active';
    document.body.appendChild(b);
  });
})();
