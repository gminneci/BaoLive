async function handleSubmit(event) {
  event.preventDefault();

  const password = document.getElementById('password').value;
  const errorDiv = document.getElementById('error-message');
  const submitBtn = document.getElementById('submit-btn');

  errorDiv.style.display = 'none';
  submitBtn.disabled = true;
  submitBtn.textContent = 'Signing in...';

  try {
    const response = await fetch('/api/auth/signin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password })
    });

    if (response.ok) {
      window.location.href = '/admin.html';
    } else {
      const data = await response.json();
      errorDiv.textContent = data.error || 'Invalid password';
      errorDiv.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Continue';
    }
  } catch (error) {
    errorDiv.textContent = 'Sign in failed. Please try again.';
    errorDiv.style.display = 'block';
    submitBtn.disabled = false;
    submitBtn.textContent = 'Continue';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('signin-form');
  if (form) {
    form.addEventListener('submit', handleSubmit);
  }
});
