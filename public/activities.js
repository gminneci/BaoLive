let accessKey = null;
let familyData = null;
let activities = [];
let mySignups = [];

window.addEventListener('DOMContentLoaded', async () => {
  accessKey = localStorage.getItem('accessKey');

  if (!accessKey) {
    const lp = document.getElementById('login-prompt');
    if (lp) lp.classList.remove('hidden');
    return;
  }

  await loadFamilyData();
  await loadActivities();
  await loadMySignups();
  const s = document.getElementById('save-close-section');
  if (s) s.classList.remove('hidden');

  // Wire static button listeners
  const btnExit = document.getElementById('btn-exit');
  const btnClosePayment = document.getElementById('btn-close-payment');
  if (btnExit) btnExit.addEventListener('click', exitToHome);
  if (btnClosePayment) btnClosePayment.addEventListener('click', closePaymentModal);
});

async function loadFamilyData() {
  try {
    familyData = await fetchJSON(`${API_URL}/families/access/${accessKey}`);
    document.getElementById('activities-container').classList.remove('hidden');
    document.getElementById('my-signups').classList.remove('hidden');
    updateBookingRefBanner();
  } catch (error) {
    console.error('Error loading family data:', error);
    showAlert('Error loading family data', 'error');
    document.getElementById('login-prompt').classList.remove('hidden');
  }
}

function updateBookingRefBanner() {
  if (!familyData) return;

  const banner = document.getElementById('booking-ref-banner');
  const bookingRef = familyData.booking_ref;

  const seftonChildren = familyData.members
    .filter(m => m.is_child && (m.class === 'Baobab' || m.class === 'Olive'))
    .map(m => m.name);

  if (seftonChildren.length > 0) {
    banner.innerHTML = `🎯 Booking Ref: <strong>${bookingRef}</strong> (${seftonChildren.join(', ')})`;
  } else {
    banner.innerHTML = `🎯 Booking Ref: <strong>${bookingRef}</strong>`;
  }

  banner.style.display = 'block';
}

async function loadActivities() {
  try {
    activities = await fetchJSON(`${API_URL}/activities?access_key=${accessKey}`);
  } catch (error) {
    console.error('Error loading activities:', error);
    showAlert('Error loading activities', 'error');
  }
}

async function loadMySignups() {
  try {
    mySignups = await fetchJSON(`${API_URL}/activity-signups/family/${accessKey}`);
    renderActivities();
    renderMySignups();
    await updateFinancials();
  } catch (error) {
    console.error('Error loading signups:', error);
  }
}

async function updateFinancials() {
  try {
    familyData = await fetchJSON(`${API_URL}/families/access/${accessKey}`);
    renderPaymentSection();
  } catch (err) {
    console.error(err);
  }
}

function renderActivities() {
  const container = document.getElementById('activities-list');

  const children = familyData.members.filter(m => m.is_child);
  const adults = familyData.members.filter(m => !m.is_child);

  if (familyData.members.length === 0) {
    container.innerHTML = '<p>No family members registered.</p>';
    return;
  }

  container.innerHTML = activities.map(activity => {
    const existingSignup = mySignups.find(s => s.activity_id === activity.id);
    const signedUpNames = existingSignup ? existingSignup.children : [];

    const allowedAges = activity.allowed_ages || 'both';

    let eligibleMembers = [];
    if (allowedAges === 'child') eligibleMembers = children;
    else if (allowedAges === 'adult') eligibleMembers = adults;
    else eligibleMembers = [...children, ...adults];

    return `
      <div class="activity-card">
        <div class="activity-header">
          <div class="activity-name">${activity.name}</div>
          <div class="activity-cost">£${activity.cost.toFixed(2)}</div>
        </div>
        <div class="activity-time">📅 ${activity.session_time}</div>
        <p style="margin-bottom: 5px; color: var(--earth-brown);">${activity.description}</p>
        
        <div style="margin-bottom: 15px;">
            ${(() => {
              if (allowedAges === 'child') return '<span class="badge" style="background:#e0f7fa; color:#006064; font-size:0.8em;">👶 Children Only</span>';
              if (allowedAges === 'adult') return '<span class="badge" style="background:#fce4ec; color:#880e4f; font-size:0.8em;">🧑 Adults Only</span>';
              return '<span class="badge" style="background:var(--light-cream); color:var(--night-blue); font-size:0.8em;">Everyone Welcome</span>';
            })()}
        </div>

        <div style="margin-top: 15px;">
          <strong style="color: var(--forest-green);">Select Participants:</strong>
          <div class="checkbox-group" style="margin-top: 10px;">
            ${eligibleMembers.length > 0 ? eligibleMembers.map(member => `
              <label class="checkbox-label">
                <input 
                  type="checkbox" 
                  class="activity-child-checkbox"
                  data-activity-id="${activity.id}"
                  data-activity-cost="${activity.cost}"
                  data-child-name="${member.name}"
                  ${signedUpNames.includes(member.name) ? 'checked' : ''}
                >
                <span>${member.name}</span>
              </label>
            `).join('') : '<span style="color:#999; font-style:italic;">No eligible members for this activity.</span>'}
          </div>
        </div>
      </div>
    `;
  }).join('');

  const checkboxes = document.querySelectorAll('.activity-child-checkbox');
  checkboxes.forEach(cb => {
    cb.addEventListener('change', () => {
      const activityId = parseInt(cb.dataset.activityId, 10);
      saveActivitySelection(activityId);
    });
  });
}

async function saveActivitySelection(activityId) {
  try {
    const selected = Array.from(document.querySelectorAll(`.activity-child-checkbox[data-activity-id="${activityId}"]:checked`))
      .map(cb => cb.dataset.childName);

    const response = await fetch(`${API_URL}/activity-signups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        activity_id: activityId,
        access_key: accessKey,
        children: selected
      })
    });

    if (!response.ok) {
      showAlert('Error saving activity selection', 'error');
      return;
    }

    await loadMySignups();
  } catch (error) {
    console.error('Error saving activity selection:', error);
    showAlert('Error saving activity selection', 'error');
  }
}

function renderMySignups() {
  const container = document.getElementById('signups-list');

  if (mySignups.length === 0) {
    container.innerHTML = '<p style="color: var(--earth-brown);">No activities signed up yet.</p><div id="payment-status-section"></div>';
    renderPaymentSection();
    return;
  }

  const signupsList = mySignups.filter(s => s.children.length > 0).map(signup => {
    const activityTotal = signup.cost * signup.children.length;

    return `
      <div style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 2px solid white;">
        <strong style="color: var(--forest-green);">${signup.activity_name}</strong>
        <br>
        <small style="color: var(--leaf-green);">${signup.session_time}</small>
        <br>
        <strong>Children:</strong> ${signup.children.join(', ')}
        ${signup.cost > 0 ? `
          <br>
          <strong>Cost:</strong> £${signup.cost.toFixed(2)} × ${signup.children.length} = £${activityTotal.toFixed(2)}
        ` : ''}
      </div>
    `;
  }).join('');

  container.innerHTML = `
    ${signupsList ? `<div style="background: var(--light-cream); padding: 20px; border-radius: 15px;">
      ${signupsList}
    </div>` : '<p style="color: var(--earth-brown);">No activities signed up yet.</p>'}
    <div id="payment-status-section"></div>
  `;

  renderPaymentSection();
}

function renderPaymentSection() {
  const paymentSection = document.getElementById('payment-status-section');
  if (!paymentSection || !familyData) return;

  const totalDue = familyData.total_owed || 0;
  const totalPaid = familyData.total_paid || 0;
  const unpaid = familyData.outstanding || 0;

  if (totalDue > 0 || totalPaid > 0) {
    paymentSection.innerHTML = `
      <div style="padding: 15px; background: white; border-radius: 10px;">
        <strong style="color: ${unpaid > 0.01 ? 'var(--sunset-orange)' : unpaid < -0.01 ? '#FF6B6B' : 'var(--bright-green)'};">Outstanding:</strong>
        <span style="float: right; font-size: 1.2em; font-weight: bold; color: ${unpaid > 0.01 ? 'var(--sunset-orange)' : unpaid < -0.01 ? '#FF6B6B' : 'var(--bright-green)'};">£${unpaid.toFixed(2)}</span>
      </div>
    </div>

      ${unpaid > 0.01 ? `
        <button id="btn-make-payment" class="btn btn-primary btn-block">
          💳 Pay Now (£${unpaid.toFixed(2)})
        </button>
      ` : unpaid < -0.01 ? `
        <button class="btn btn-block" style="background: #ccc; color: #666; cursor: not-allowed;" disabled>
          ⚠️ Unable to Cancel Automatically
        </button>
        <p style="text-align: center; margin-top: 15px; margin-bottom: 0; color: var(--earth-brown); font-size: 0.95em;">
          You have overpaid by <strong style="color: #FF6B6B;">£${Math.abs(unpaid).toFixed(2)}</strong>. Please contact an admin to process your refund.
        </p>
      ` : `
        <div style="text-align: center; padding: 20px; background: var(--bright-green); color: white; border-radius: 10px; font-weight: bold;">
          ✓ All payments complete!
        </div>
      `}

      <p style="text-align: center; margin-top: 20px; margin-bottom: 0; color: var(--earth-brown); font-size: 0.9em;">
        Questions? Ask on the school camping WhatsApp chat.
      </p>
    `;

    // Bind payment button click after render
    const btnMakePayment = document.getElementById('btn-make-payment');
    if (btnMakePayment) btnMakePayment.addEventListener('click', openPaymentModal);
  } else {
    paymentSection.innerHTML = '';
  }
}

function openPaymentModal() {
  if (!familyData) return;

  const totalDue = familyData.total_owed || 0;
  const totalPaid = familyData.total_paid || 0;
  const unpaid = familyData.outstanding || 0;

  if (unpaid <= 0) {
    showAlert('No outstanding balance to pay.', 'info');
    return;
  }

  const allSignupsHtml = mySignups
    .filter(s => s.children && s.children.length > 0 && s.cost > 0)
    .map(s => `
      <div style="margin-bottom: 5px; font-size: 0.9em;">
        <strong>${s.activity_name}</strong> - £${(s.cost * s.children.length).toFixed(2)}
      </div>
    `).join('');

  const detailsHtml = `
    <p style="margin-bottom: 15px;">
      <strong>Booking Reference ${familyData.booking_ref}</strong>
    </p>
    
    <div style="background: white; padding: 15px; border-radius: 10px; margin-bottom: 15px;">
      <h4 style="margin-top:0; color: var(--forest-green);">Activity Summary</h4>
      ${allSignupsHtml || '<p>No paid activities selected.</p>'}
      
      <hr style="margin: 10px 0; border: 0; border-top: 1px solid #ddd;">
      
      <div style="display:flex; justify-content:space-between;">
        <span>Total Cost:</span>
        <strong>£${totalDue.toFixed(2)}</strong>
      </div>
      <div style="display:flex; justify-content:space-between; color: var(--bright-green);">
        <span>Already Paid:</span>
        <strong>-£${totalPaid.toFixed(2)}</strong>
      </div>
      <div style="display:flex; justify-content:space-between; margin-top: 10px; padding-top: 10px; border-top: 2px solid var(--forest-green); font-size: 1.2em;">
        <span>To Pay Now:</span>
        <strong style="color: var(--sunset-orange);">£${unpaid.toFixed(2)}</strong>
      </div>
    </div>
  `;

  document.getElementById('payment-details').innerHTML = detailsHtml;
  document.getElementById('payment-modal').style.display = 'flex';
}

function closePaymentModal() {
  document.getElementById('payment-modal').style.display = 'none';
}

async function confirmPayment() {
  if (!familyData) return;

  const unpaid = familyData.outstanding || 0;

  if (unpaid <= 0) {
    closePaymentModal();
    showAlert('Nothing to pay!', 'info');
    return;
  }

  let paymentNote = '';
  const paidSignups = mySignups.filter(s => s.cost > 0);

  if (paidSignups && paidSignups.length > 0) {
    const details = paidSignups.map(signup => {
      const costPerChild = signup.cost;
      const totalCost = costPerChild * signup.children.length;
      const childrenList = signup.children.join(' and ');
      return `£${totalCost.toFixed(2)} for ${childrenList} ${signup.activity_name}`;
    });
    paymentNote = details.join('; ');
  } else {
    paymentNote = 'Payment for outstanding balance';
  }

  try {
    const response = await fetch(`${API_URL}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        access_key: accessKey,
        amount: unpaid,
        notes: paymentNote
      })
    });

    closePaymentModal();

    if (response.ok) {
      showAlert(`Payment successful! ✓ £${unpaid.toFixed(2)} has been recorded.`, 'success');
      await loadMySignups();
      await updateFinancials();
    } else {
      const errorData = await response.json();
      showAlert(`Error processing payment: ${errorData.error || 'Unknown error'}`, 'error');
    }
  } catch (error) {
    closePaymentModal();
    console.error('Error processing payment:', error);
    showAlert('Error processing payment. Please try again.', 'error');
  }
}

function exitToHome() {
  window.location.href = 'index.html';
}

// Note: All listeners are wired in the main DOMContentLoaded above.
