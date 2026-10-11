    (function () {
      var menuBtn = document.getElementById('menuBtn');
      var nav = document.getElementById('mainNav');
      if (menuBtn && nav) {
        menuBtn.addEventListener('click', function () {
          var open = nav.classList.toggle('open');
          menuBtn.setAttribute('aria-expanded', String(open));
          menuBtn.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
        });
        nav.querySelectorAll('a').forEach(function (link) {
          link.addEventListener('click', function () {
            nav.classList.remove('open');
            menuBtn.setAttribute('aria-expanded', 'false');
          });
        });
      }
      var form = document.getElementById('projectForm');
      var status = document.getElementById('formStatus');
      if (form && status) {
        form.addEventListener('submit', function (event) {
          event.preventDefault();
          if (!form.checkValidity()) {
            form.reportValidity();
            status.textContent = 'Please complete all required fields.';
            return;
          }
          status.textContent = 'Sending your inquiry...';
          fetch('inquiry.php', { method: 'POST', body: new FormData(form) })
            .then(function (r) { return r.json(); })
            .then(function (res) {
              if (res.ok) {
                status.textContent = 'Thank you! Your inquiry has been sent. We will reply within 1 business day.';
                form.reset();
              } else {
                status.textContent = 'Sorry, something went wrong sending your inquiry. Please email us directly at info@hifilldesignstudio.com.';
              }
            })
            .catch(function () {
              status.textContent = 'Sorry, something went wrong sending your inquiry. Please email us directly at info@hifilldesignstudio.com.';
            });
        });
      }
    })();
