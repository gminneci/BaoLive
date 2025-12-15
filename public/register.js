let memberCount = 0;
let existingFamily = null;
const accessKey = localStorage.getItem('accessKey');

window.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const refParam = urlParams.get('ref');
  const isNew = urlParams.get('new') === 'true';

  if (refParam) {
    document.getElementById('booking-ref').value = refParam;
    if (isNew) {
      localStorage.removeItem('accessKey');
      addMember(true);
      updateBookingRefBanner();
      return;
    }
  }

  if (accessKey) {
    await loadExistingFamily(accessKey);
  } else {
    if (!refParam) addMember(true);
    updateBookingRefBanner();
  }

  document.getElementById('btn-add-child').addEventListener('click', () => addMember(true));
  document.getElementById('btn-add-adult').addEventListener('click', () => addMember(false));

  document.getElementById('members-container').addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-btn')) {
      const memberId = e.target.getAttribute('data-member-id');
      removeMember(memberId);
    }
  });
});

async function loadExistingFamily(accessKey) {
  try {
    existingFamily = await fetchJSON(`${API_URL}/families/access/${accessKey}`);
    populateForm(existingFamily);
    showAlert('Editing existing registration - please double check that this is your family 🙏', 'info');
  } catch (error) {
    showAlert('Error loading existing registration', 'error');
  }
}

function populateForm(family) {
  document.getElementById('booking-ref').value = family.booking_ref;
  document.getElementById('booking-ref').readOnly = true;

  const typeRadio = document.querySelector(`input[name="camping-type"][value="${family.camping_type}"]`);
  if (typeRadio) typeRadio.checked = true;

  family.nights.forEach(night => {
    const nightCheck = document.querySelector(`input[name="nights"][value="${night}"]`);
    if (nightCheck) nightCheck.checked = true;
  });

  family.members.forEach(member => {
    addMember(member.is_child === 1, member);
  });

  updateBookingRefBanner();
}

function updateBookingRefBanner() {
  const banner = document.getElementById('booking-ref-banner');
  const bookingRef = document.getElementById('booking-ref').value;

  const seftonChildren = [];
  const memberCards = document.querySelectorAll('.member-card.child');

  memberCards.forEach((card) => {
    const id = card.id.split('-')[1];
    const nameInput = document.querySelector(`input[name="member-name-${id}"]`);
    const classRadio = document.querySelector(`input[name="member-class-${id}"]:checked`);

    if (nameInput && classRadio && (classRadio.value === 'Baobab' || classRadio.value === 'Olive')) {
      const name = nameInput.value.trim();
      if (name) {
        seftonChildren.push(name);
      }
    }
  });

  banner.style.display = 'block';

  if (existingFamily || bookingRef) {
    const ref = bookingRef || 'Loading...';
    if (seftonChildren.length > 0) {
      banner.innerHTML = `✏️ Editing: Booking Ref <strong>${ref}</strong> (${seftonChildren.join(', ')})`;
      banner.style.background = 'var(--sunset-orange)';
    } else {
      banner.innerHTML = `✏️ Editing: Booking Ref <strong>${ref}</strong> (No Olive/Baobab children yet)`;
      banner.style.background = 'var(--sunset-orange)';
    }
  } else {
    if (seftonChildren.length > 0) {
      banner.innerHTML = `📝 New Registration (${seftonChildren.join(', ')})`;
      banner.style.background = 'var(--bright-green)';
    } else {
      banner.innerHTML = '📝 New Registration';
      banner.style.background = 'var(--bright-green)';
    }
  }
}

function addMember(isChild, data = null) {
  memberCount++;
  const membersContainer = document.getElementById('members-container');

  const memberCard = document.createElement('div');
  memberCard.className = `member-card ${isChild ? 'child' : ''}`;
  memberCard.id = `member-${memberCount}`;

  memberCard.innerHTML = `
    <button type="button" class="remove-btn" data-member-id="${memberCount}">×</button>
    <h4 style="color: var(--forest-green); margin-bottom: 15px;">
      ${isChild ? '👦 Child' : '👨 Adult'}
    </h4>
    
    <div class="form-group">
      <label>Name *</label>
      <input 
        type="text" 
        name="member-name-${memberCount}" 
        value="${data?.name || ''}"
        required
      >
    </div>

    <input type="hidden" name="member-is-child-${memberCount}" value="${isChild ? '1' : '0'}">

    ${isChild ? `
      <div class="form-group">
        <label>Class / Group *</label>
        <div class="checkbox-group">
          <label class="checkbox-label">
            <input type="radio" name="member-class-${memberCount}" value="Baobab" ${data?.class === 'Baobab' ? 'checked' : ''} required>
            <span>Baobab</span>
          </label>
          <label class="checkbox-label">
            <input type="radio" name="member-class-${memberCount}" value="Olive" ${data?.class === 'Olive' ? 'checked' : ''}>
            <span>Olive</span>
          </label>
          <label class="checkbox-label">
            <input type="radio" name="member-class-${memberCount}" value="Other" ${(data?.class && data.class !== 'Baobab' && data.class !== 'Olive') ? 'checked' : ''}>
            <span>Other / Sibling</span>
          </label>
        </div>
      </div>
    ` : ''}
  `;

  membersContainer.appendChild(memberCard);

  if (isChild) {
    const nameInput = memberCard.querySelector(`input[name="member-name-${memberCount}"]`);
    const classRadios = memberCard.querySelectorAll(`input[name="member-class-${memberCount}"]`);

    nameInput.addEventListener('input', updateBookingRefBanner);
    classRadios.forEach(radio => {
      radio.addEventListener('change', updateBookingRefBanner);
    });
  }

  updateBookingRefBanner();
}

function removeMember(id) {
  const member = document.getElementById(`member-${id}`);
  if (member) {
    member.remove();
    updateBookingRefBanner();
  }
}

document.getElementById('registration-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const formData = new FormData(e.target);
  const bookingRef = document.getElementById('booking-ref').value;
  const campingType = formData.get('camping-type');
  const nights = formData.getAll('nights');

  if (nights.length === 0) {
    showAlert('Please select at least one night', 'error');
    return;
  }

  const members = [];
  const memberCards = document.querySelectorAll('.member-card');

  memberCards.forEach((card) => {
    const id = card.id.split('-')[1];
    const name = formData.get(`member-name-${id}`);
    const isChild = formData.get(`member-is-child-${id}`) === '1';
    const classValue = isChild ? formData.get(`member-class-${id}`) : null;

    if (name) {
      members.push({
        name,
        is_child: isChild,
        class: classValue
      });
    }
  });

  if (members.length === 0) {
    showAlert('Please add at least one family member', 'error');
    return;
  }

  const childNames = members.filter(m => m.is_child).map(m => m.name);
  if (childNames.length === 0) {
    showAlert('Please add at least one child', 'error');
    return;
  }

  const seftonChildren = members.filter(m => m.is_child && (m.class === 'Baobab' || m.class === 'Olive'));
  if (seftonChildren.length === 0) {
    alert('⚠️ At least one Sefton Park student (Baobab or Olive class) must be added before you can proceed to activity sign-ups.\n\nPlease add a child and select either Baobab or Olive as their class.');
    return;
  }

  try {
    if (!existingFamily) {
      try {
        const checkData = await fetchJSON(`${API_URL}/families/check/${bookingRef}`);
        if (checkData.exists) {
          showAlert(`Booking reference "${bookingRef}" is already registered. You are editing it now? (This shouldn't happen if flow is correct)`, 'error');
          return;
        }
      } catch (err) {
        showAlert('Error checking booking reference', 'error');
        return;
      }
    }

    const postBody = {
      booking_ref: bookingRef,
      members,
      camping_type: campingType,
      nights
    };

    let result;
    try {
      result = await fetchJSON(`${API_URL}/families`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postBody)
      });
    } catch (err) {
      showAlert(err.message || 'Error saving registration', 'error');
      return;
    }

    if (result && result.access_key) {
      localStorage.setItem('accessKey', result.access_key);
      showAlert('Registration saved successfully! 🎉 Redirecting to activities...', 'success');
      setTimeout(() => {
        window.location.href = 'activities.html';
      }, 1500);
    } else {
      // Likely an update of an existing family; use existing access key if present
      const existingKey = accessKey || (existingFamily && existingFamily.access_key);
      if (existingKey) {
        showAlert('Registration updated! Redirecting to activities...', 'success');
        setTimeout(() => {
          window.location.href = 'activities.html';
        }, 1000);
        return;
      }
      // Fallback: fetch family by booking ref to get access key
      try {
        const fam = await fetchJSON(`${API_URL}/families/booking/${bookingRef}`);
        if (fam && fam.access_key) {
          localStorage.setItem('accessKey', fam.access_key);
          showAlert('Registration saved! Redirecting to activities...', 'success');
          setTimeout(() => {
            window.location.href = 'activities.html';
          }, 1000);
          return;
        }
      } catch {}
      showAlert('Error saving registration', 'error');
    }
  } catch (error) {
    showAlert('Error saving registration. Please try again.', 'error');
  }
});
