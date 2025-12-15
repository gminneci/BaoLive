let currentRef = '';
let pendingFamily = null;

async function handleBookingLookup(e) {
  e.preventDefault();
  const refInput = document.getElementById('booking-ref');
  const ref = refInput.value.trim();

  if (!ref) return;
  currentRef = ref;

  try {
    const response = await fetch(`${API_URL}/families/check/${ref}`);
    const data = await response.json();

    if (data.exists) {
      const familyResp = await fetch(`${API_URL}/families/booking/${ref}`);
      if (familyResp.ok) {
        const family = await familyResp.json();
        pendingFamily = family;

        const seftonChildren = family.members
          .filter(m => m.is_child && (m.class === 'Baobab' || m.class === 'Olive'))
          .map(m => m.name);

        const childrenText = seftonChildren.length > 0
          ? seftonChildren.join(', ')
          : 'this family';

        document.getElementById('confirm-message').innerHTML =
          `The booking reference "${ref}" matches the registration for <strong>${childrenText}</strong>. Is this your family?`;

        document.getElementById('confirm-modal').style.display = 'flex';
      } else {
        showAlert('Error accessing registration.', 'error');
      }
    } else {
      document.getElementById('modal-ref').textContent = ref;
      document.getElementById('new-reg-modal').style.display = 'flex';
    }
  } catch (error) {
    console.error(error);
    showAlert('Error checking reference.', 'error');
  }
}

function confirmAccess() {
  if (pendingFamily) {
    localStorage.setItem('accessKey', pendingFamily.access_key);
    window.location.href = 'register.html';
  }
}

function closeModal() {
  document.getElementById('confirm-modal').style.display = 'none';
  document.getElementById('booking-ref').value = '';
  pendingFamily = null;
}

function proceedToNew() {
  window.location.href = `register.html?new=true&ref=${encodeURIComponent(currentRef)}`;
}

function closeNewModal() {
  document.getElementById('new-reg-modal').style.display = 'none';
  document.getElementById('booking-ref').value = '';
}

// Wire up event listeners to comply with strict CSP (no inline handlers)
document.addEventListener('DOMContentLoaded', () => {
  const bookingForm = document.getElementById('booking-form');
  if (bookingForm) bookingForm.addEventListener('submit', handleBookingLookup);

  const btnConfirm = document.getElementById('btn-confirm-access');
  if (btnConfirm) btnConfirm.addEventListener('click', (e) => { e.preventDefault(); confirmAccess(); });

  const btnCloseConfirm = document.getElementById('btn-close-confirm');
  if (btnCloseConfirm) btnCloseConfirm.addEventListener('click', (e) => { e.preventDefault(); closeModal(); });

  const btnProceedNew = document.getElementById('btn-proceed-new');
  if (btnProceedNew) btnProceedNew.addEventListener('click', (e) => { e.preventDefault(); proceedToNew(); });

  const btnCloseNew = document.getElementById('btn-close-new');
  if (btnCloseNew) btnCloseNew.addEventListener('click', (e) => { e.preventDefault(); closeNewModal(); });
});
