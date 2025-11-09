
// fix-client.js -- added by inspector
document.addEventListener('DOMContentLoaded', function(){
  // Intercept forms without action and prevent default to show message
  document.querySelectorAll('form').forEach(function(f){
    if(!f.getAttribute('action')){
      f.addEventListener('submit', function(e){
        e.preventDefault();
        alert('Form submitted (client-only). The site expects a server backend. See README for fixes.');
        console.log('Intercepted submit for', f);
      });
    }
  });
  // Intercept links/buttons with data-backend or common login/admin classes
  document.querySelectorAll('a, button').forEach(function(el){
    var href = el.getAttribute('href') || '';
    var cls = el.className || '';
    if(href.match(/\.php|\/admin|login/i) || cls.match(/login|admin|auth/i)){
      el.addEventListener('click', function(e){
        // if link points to missing resource, prevent navigation and show a message
        if(href && (href.endsWith('.php') || href.includes('/admin') || href.toLowerCase().includes('login'))){
          e.preventDefault();
          alert('This site requires a server backend endpoint ('+href+'). Currently no backend found in the package. Open README for next steps.');
        } else {
          // for buttons show a client-side fallback
          e.preventDefault();
          alert('Button pressed. This is a client-side fallback because server backend is missing.');
        }
      });
    }
  });
});
