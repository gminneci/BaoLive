let families = [];
let activitySignups = [];
let allActivities = [];
let payments = [];
let backups = [];

// Sorting state
let sortState = {
    activities: { column: null, ascending: true },
    families: { column: null, ascending: true },
    signups: { column: null, ascending: true }
};

// Tab switching
function switchTab(tab) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
    document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));

    // Show selected tab
    document.getElementById(`content-${tab}`).style.display = 'block';
    document.getElementById(`tab-${tab}`).classList.add('active');
}

window.addEventListener('DOMContentLoaded', async () => {
    await loadFamilies();
    await loadActivitySignups();
    await loadAllActivities();
    await loadPayments();
    await loadBackups();

    // Tab Navigation
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');
            switchTab(tabName);
        });
    });

    // Static Buttons
    const btnExportFamilies = document.getElementById('btn-export-families');
    if (btnExportFamilies) btnExportFamilies.addEventListener('click', exportFamilies);

    const btnExportActivities = document.getElementById('btn-export-activities');
    if (btnExportActivities) btnExportActivities.addEventListener('click', exportActivities);

    const btnOpenAddActivity = document.getElementById('btn-open-add-activity');
    if (btnOpenAddActivity) btnOpenAddActivity.addEventListener('click', openAddModal);

    const btnCreateBackupTab = document.getElementById('btn-create-backup-tab');
    if (btnCreateBackupTab) btnCreateBackupTab.addEventListener('click', createBackup);

    // Modal Cancel/Close Buttons
    const btnCancelAdd = document.getElementById('btn-cancel-add');
    if (btnCancelAdd) btnCancelAdd.addEventListener('click', closeAddModal);

    const btnCancelEdit = document.getElementById('btn-cancel-edit');
    if (btnCancelEdit) btnCancelEdit.addEventListener('click', closeEditModal);

    const btnDeleteActivity = document.getElementById('btn-delete-activity');
    if (btnDeleteActivity) btnDeleteActivity.addEventListener('click', deleteActivity);

    const btnCancelEditFamily = document.getElementById('btn-cancel-edit-family');
    if (btnCancelEditFamily) btnCancelEditFamily.addEventListener('click', closeEditFamilyModal);

    const btnEditAddChild = document.getElementById('btn-edit-add-child');
    if (btnEditAddChild) btnEditAddChild.addEventListener('click', () => addEditMember(true));

    const btnEditAddAdult = document.getElementById('btn-edit-add-adult');
    if (btnEditAddAdult) btnEditAddAdult.addEventListener('click', () => addEditMember(false));

    const btnCancelEditPayment = document.getElementById('btn-cancel-edit-payment');
    if (btnCancelEditPayment) btnCancelEditPayment.addEventListener('click', closeEditPaymentModal);

    // Event Delegation
    document.getElementById('families-container').addEventListener('click', (e) => {
        if (e.target.matches('.action-edit-family')) {
            e.preventDefault();
            editFamily(e.target.dataset.accessKey);
        } else if (e.target.matches('.action-delete-family')) {
            deleteFamily(e.target.dataset.accessKey, e.target.dataset.bookingRef);
        } else if (e.target.matches('.sortable')) {
            sortFamilies(e.target.dataset.sort);
        }
    });

    document.getElementById('manage-activities-container').addEventListener('click', (e) => {
        if (e.target.matches('.action-edit-activity')) {
            e.preventDefault();
            editActivity(parseInt(e.target.dataset.activityId));
        } else if (e.target.matches('.action-toggle-availability')) {
            toggleActivityAvailability(parseInt(e.target.dataset.activityId), e.target.dataset.available === 'true');
        } else if (e.target.matches('.sortable')) {
            sortActivities(e.target.dataset.sort);
        }
    });

    document.getElementById('activities-container').addEventListener('click', (e) => {
        if (e.target.matches('.sortable')) {
            sortSignups(e.target.dataset.sort);
        }
    });

    document.getElementById('payments-container').addEventListener('click', (e) => {
        if (e.target.matches('.action-edit-payment')) {
            editPayment(
                parseInt(e.target.dataset.id),
                e.target.dataset.date,
                parseFloat(e.target.dataset.amount),
                e.target.dataset.notes
            );
        } else if (e.target.matches('.action-void-payment')) {
            voidPayment(parseInt(e.target.dataset.id));
        } else if (e.target.matches('.action-reinstate-payment')) {
            reinstatePayment(parseInt(e.target.dataset.id));
        }
    });

    document.getElementById('backups-container').addEventListener('click', (e) => {
        if (e.target.matches('.action-download-backup')) {
            downloadBackup(e.target.dataset.filename);
        } else if (e.target.matches('.action-delete-backup')) {
            deleteBackup(e.target.dataset.filename);
        }
    });

    document.getElementById('edit-members-container').addEventListener('click', (e) => {
        if (e.target.matches('.action-remove-edit-member')) {
            removeEditMember(e.target.dataset.id);
        }
    });
});

async function loadFamilies() {
    try {
        families = await fetchJSON(`${API_URL}/families`);
        renderFamilies();
    } catch (error) {
        document.getElementById('families-container').innerHTML = '<p class="alert alert-error">Error loading families</p>';
    }
}

async function loadAllActivities() {
    try {
        allActivities = await fetchJSON(`${API_URL}/activities/all`);
        renderAllActivities();
    } catch (error) {
        document.getElementById('manage-activities-container').innerHTML = '<p class="alert alert-error">Error loading activities</p>';
    }
}

async function loadPayments() {
    try {
        payments = await fetchJSON(`${API_URL}/payments`);
        renderPayments();
    } catch (error) {
        document.getElementById('payments-container').innerHTML = '<p class="alert alert-error">Error loading payments</p>';
    }
}

function renderPayments() {
    const container = document.getElementById('payments-container');

    if (payments.length === 0) {
        container.innerHTML = '<p>No payment transactions yet.</p>';
        return;
    }

    container.innerHTML = `
                <div style="overflow-x: auto;">
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Booking Ref</th>
                                <th>Amount</th>
                                <th>Notes</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${payments.map(payment => {
        const isCancelled = payment.cancelled == 1 || payment.cancelled === true;
        return `
                                <tr style="${isCancelled ? 'opacity: 0.5;' : ''}">
                                    <td style="${isCancelled ? 'text-decoration: line-through; color: #999;' : ''}">${new Date(payment.payment_date).toLocaleDateString()}</td>
                                    <td style="${isCancelled ? 'text-decoration: line-through; color: #999;' : ''}"><strong>${payment.booking_ref}</strong></td>
                                    <td style="${isCancelled ? 'text-decoration: line-through; color: #999;' : ''}">£${payment.amount.toFixed(2)}${isCancelled ? ' <span style="color: var(--sunset-orange); font-weight: bold; text-decoration: none;">(VOIDED)</span>' : ''}</td>
                                    <td style="${isCancelled ? 'text-decoration: line-through; color: #999;' : ''}">${payment.notes || '-'}</td>
                                    <td>
                                        <div style="display: flex; gap: 5px;">
                                            ${!isCancelled ? `
                                                <button class="btn btn-info btn-small action-edit-payment" 
                                                    data-id="${payment.id}"
                                                    data-date="${payment.payment_date}"
                                                    data-amount="${payment.amount}"
                                                    data-notes="${(payment.notes || '').replace(/"/g, '&quot;')}"
                                                >Edit</button>
                                                <button class="btn btn-warning btn-small action-void-payment" data-id="${payment.id}">Void</button>
                                            ` : `
                                                <button class="btn btn-primary btn-small action-reinstate-payment" data-id="${payment.id}">Reinstate</button>
                                            `}
                                        </div>
                                    </td>
                                </tr>
                            `}).join('')}
                        </tbody>
                    </table>
                </div>
                <p style="margin-top: 20px; color: var(--earth-brown);">
                    <strong>Total Payments (Active):</strong> £${payments.filter(p => !p.cancelled).reduce((sum, p) => sum + p.amount, 0).toFixed(2)}
                    <span style="margin-left: 20px; color: #999;">
                        <strong>Voided:</strong> £${payments.filter(p => p.cancelled).reduce((sum, p) => sum + p.amount, 0).toFixed(2)}
                    </span>
                </p>
            `;
}

function editPayment(id, date, amount, notes) {
    document.getElementById('edit-payment-id').value = id;
    // Format date for HTML date input (YYYY-MM-DD)
    const dateObj = new Date(date);
    const formattedDate = dateObj.toISOString().split('T')[0];
    document.getElementById('edit-payment-date').value = formattedDate;
    document.getElementById('edit-payment-amount').value = amount;
    document.getElementById('edit-payment-notes').value = notes === '-' ? '' : notes;
    document.getElementById('edit-payment-modal').style.display = 'flex';
}

function closeEditPaymentModal() {
    document.getElementById('edit-payment-modal').style.display = 'none';
    document.getElementById('edit-payment-form').reset();
}

async function voidPayment(id) {
    if (!confirm('Are you sure you want to VOID this payment?\n\nThis will mark the payment as cancelled and exclude it from balance calculations, but keep it in the audit trail.')) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/payments/${id}/void`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        if (response.ok) {
            showAlert('Payment voided successfully', 'success');
            // Force reload all data
            await Promise.all([
                loadPayments(),
                loadFamilies(),
                loadActivitySignups()
            ]);
            // Re-render signups with updated family data
            renderActivitySignups();
        } else {
            showAlert('Error voiding payment', 'error');
        }
    } catch (error) {
        console.error('Error voiding payment:', error);
        showAlert('Error voiding payment', 'error');
    }
}

async function reinstatePayment(id) {
    if (!confirm('Reinstate this payment?\n\nThis will restore the payment and include it in balance calculations.')) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/payments/${id}/reinstate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        if (response.ok) {
            showAlert('Payment reinstated successfully', 'success');
            // Force reload all data
            await Promise.all([
                loadPayments(),
                loadFamilies(),
                loadActivitySignups()
            ]);
            // Re-render signups with updated family data
            renderActivitySignups();
        } else {
            showAlert('Error reinstating payment', 'error');
        }
    } catch (error) {
        console.error('Error reinstating payment:', error);
        showAlert('Error reinstating payment', 'error');
    }
}

async function updatePayment(id, date, amount, notes) {
    try {
        const response = await fetch(`${API_URL}/payments/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payment_date: date, amount, notes })
        });

        if (response.ok) {
            showAlert('Transaction updated successfully', 'success');
            await loadPayments();
            await loadFamilies(); // Refresh family balances
        } else {
            showAlert('Error updating transaction', 'error');
        }
    } catch (error) {
        showAlert('Error updating transaction', 'error');
    }
}

function sortActivities(column) {
    if (sortState.activities.column === column) {
        sortState.activities.ascending = !sortState.activities.ascending;
    } else {
        sortState.activities.column = column;
        sortState.activities.ascending = true;
    }
    renderAllActivities();
}

function renderAllActivities() {
    const container = document.getElementById('manage-activities-container');

    if (allActivities.length === 0) {
        container.innerHTML = '<p>No activities yet. Add one below!</p>';
        return;
    }

    // Sort activities if a column is selected
    let sortedActivities = [...allActivities];
    if (sortState.activities.column) {
        sortedActivities.sort((a, b) => {
            let aVal, bVal;
            const signupsA = activitySignups ? activitySignups.filter(s => s.activity_id === a.id) : [];
            const signupsB = activitySignups ? activitySignups.filter(s => s.activity_id === b.id) : [];
            const participantsA = signupsA.reduce((sum, s) => sum + s.children.length, 0);
            const participantsB = signupsB.reduce((sum, s) => sum + s.children.length, 0);

            switch (sortState.activities.column) {
                case 'activity':
                    aVal = a.name.toLowerCase();
                    bVal = b.name.toLowerCase();
                    break;
                case 'time':
                    aVal = a.session_time;
                    bVal = b.session_time;
                    break;
                case 'cost':
                    aVal = a.cost;
                    bVal = b.cost;
                    break;
                case 'capacity':
                    aVal = participantsA;
                    bVal = participantsB;
                    break;
                case 'status':
                    aVal = a.available ? 1 : 0;
                    bVal = b.available ? 1 : 0;
                    break;
            }

            if (aVal < bVal) return sortState.activities.ascending ? -1 : 1;
            if (aVal > bVal) return sortState.activities.ascending ? 1 : -1;
            return 0;
        });
    }

    const getSortIndicator = (column) => {
        if (sortState.activities.column === column) {
            return sortState.activities.ascending ? ' ↑' : ' ↓';
        }
        return '';
    };

    container.innerHTML = `
                <div style="overflow-x: auto;">
                    <table>
                        <thead>
                            <tr>
                                <th class="sortable" data-sort="activity" style="cursor: pointer;">Activity${getSortIndicator('activity')}</th>
                                <th class="sortable" data-sort="time" style="cursor: pointer;">Session Time${getSortIndicator('time')}</th>
                                <th class="sortable" data-sort="cost" style="cursor: pointer;">Cost${getSortIndicator('cost')}</th>
                                <th class="sortable" data-sort="capacity" style="cursor: pointer;">Capacity${getSortIndicator('capacity')}</th>
                                <th>Ages</th>
                                <th class="sortable" data-sort="status" style="cursor: pointer;">Status${getSortIndicator('status')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${sortedActivities.map(activity => {
        // Calculate current participants (check if activitySignups is loaded)
        const signupsForActivity = activitySignups ? activitySignups.filter(s => s.activity_id === activity.id) : [];
        const currentParticipants = signupsForActivity.reduce((sum, s) => sum + s.children.length, 0);
        const isFull = activity.max_participants > 0 && currentParticipants >= activity.max_participants;

        return `
                                <tr>
                                    <td>
                                        <a href="#" 
                                           class="action-edit-activity"
                                           data-activity-id="${activity.id}"
                                           style="color: var(--forest-green); text-decoration: none; font-weight: bold; cursor: pointer;">
                                            ${activity.name}
                                        </a>
                                    </td>
                                    <td>${activity.session_time}</td>
                                    <td>£${activity.cost.toFixed(2)}</td>
                                    <td>
                                        ${activity.max_participants > 0 ? `
                                            <span style="color: ${isFull ? 'var(--sunset-orange)' : 'var(--forest-green)'}; font-weight: bold;">
                                                ${currentParticipants}/${activity.max_participants}
                                            </span>
                                            ${isFull ? ' <span style="color: var(--sunset-orange);">(FULL)</span>' : ''}
                                        ` : '<span style="color: var(--earth-brown);">Unlimited</span>'}
                                    </td>
                                    <td>
                                        ${(() => {
                const ages = activity.allowed_ages || 'both';
                if (ages === 'child') return '<span class="badge" style="background:#e0f7fa; color:#006064;">👶 Child</span>';
                if (ages === 'adult') return '<span class="badge" style="background:#fce4ec; color:#880e4f;">🧑 Adult</span>';
                return '<span class="badge" style="background:var(--light-cream); color:var(--night-blue);">Both</span>';
            })()}
                                    </td>
                                    <td>
                                        <span class="paid-badge ${activity.available ? 'yes' : 'no'} action-toggle-availability" 
                                              data-activity-id="${activity.id}"
                                              data-available="${activity.available}"
                                              style="cursor: pointer;">
                                            ${activity.available ? '✔ Available' : '❌ Unavailable'}
                                        </span>
                                    </td>
                                </tr>
                            `}).join('')}
                        </tbody>
                    </table>
                </div>
            `;
}

async function toggleActivityAvailability(activityId, currentlyAvailable) {
    const newAvailability = !currentlyAvailable;
    try {
        const response = await fetch(`${API_URL}/activities/${activityId}/availability`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ available: newAvailability })
        });

        if (response.ok) {
            await loadAllActivities();
        }
    } catch (error) {
        console.error('Error toggling availability:', error);
        alert('Error updating activity availability');
    }
}

function editActivity(activityId) {
    const activity = allActivities.find(a => a.id === activityId);
    if (!activity) return;

    // Populate the edit form
    document.getElementById('edit-activity-id').value = activity.id;
    document.getElementById('edit-activity-name').value = activity.name;
    document.getElementById('edit-activity-time').value = activity.session_time;
    document.getElementById('edit-activity-cost').value = activity.cost;
    document.getElementById('edit-activity-description').value = activity.description || '';
    document.getElementById('edit-activity-max-participants').value = activity.max_participants || 0;

    const ages = activity.allowed_ages || 'both';
    document.getElementById('edit-activity-allow-child').checked = (ages === 'child' || ages === 'both');
    document.getElementById('edit-activity-allow-adult').checked = (ages === 'adult' || ages === 'both');

    // Show the modal
    const modal = document.getElementById('edit-modal');
    modal.style.display = 'flex';
}

function closeEditModal() {
    document.getElementById('edit-modal').style.display = 'none';
    document.getElementById('edit-activity-form').reset();
}

function openAddModal() {
    document.getElementById('add-modal').style.display = 'flex';
}

function closeAddModal() {
    document.getElementById('add-modal').style.display = 'none';
    document.getElementById('add-activity-form').reset();
}

// Handle edit payment form submission
document.getElementById('edit-payment-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const paymentId = document.getElementById('edit-payment-id').value;
    const date = document.getElementById('edit-payment-date').value;
    const amount = parseFloat(document.getElementById('edit-payment-amount').value);
    const notes = document.getElementById('edit-payment-notes').value;

    await updatePayment(paymentId, date, amount, notes);
    closeEditPaymentModal();
});

// Handle edit form submission
document.getElementById('edit-activity-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const activityId = document.getElementById('edit-activity-id').value;
    const name = document.getElementById('edit-activity-name').value;
    const session_time = document.getElementById('edit-activity-time').value;
    const cost = parseFloat(document.getElementById('edit-activity-cost').value) || 0;
    const description = document.getElementById('edit-activity-description').value;
    const max_participants = parseInt(document.getElementById('edit-activity-max-participants').value) || 0;

    try {
        const response = await fetch(`${API_URL}/activities/${activityId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name,
                session_time,
                cost,
                description,

                max_participants,
                allowed_ages: (() => {
                    const child = document.getElementById('edit-activity-allow-child').checked;
                    const adult = document.getElementById('edit-activity-allow-adult').checked;
                    if (child && adult) return 'both';
                    if (child) return 'child';
                    if (adult) return 'adult';
                    return 'both'; // Default fallback
                })()
            })
        });

        if (response.ok) {
            closeEditModal();
            await loadAllActivities();
            alert('Activity updated successfully! 🎉');
        } else {
            alert('Error updating activity');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error updating activity');
    }
});

async function loadActivitySignups() {
    try {
        activitySignups = await fetchJSON(`${API_URL}/activity-signups`);
        renderActivitySignups();
    } catch (error) {
        document.getElementById('activities-container').innerHTML = '<p class="alert alert-error">Error loading activity signups</p>';
    }
}

function sortFamilies(column) {
    if (sortState.families.column === column) {
        sortState.families.ascending = !sortState.families.ascending;
    } else {
        sortState.families.column = column;
        sortState.families.ascending = true;
    }
    renderFamilies();
}

function renderFamilies() {
    const container = document.getElementById('families-container');

    if (families.length === 0) {
        container.innerHTML = '<p>No families registered yet.</p>';
        return;
    }

    // Sort families if a column is selected
    let sortedFamilies = [...families];
    if (sortState.families.column) {
        sortedFamilies.sort((a, b) => {
            let aVal, bVal;

            switch (sortState.families.column) {
                case 'booking':
                    aVal = a.booking_ref.toLowerCase();
                    bVal = b.booking_ref.toLowerCase();
                    break;
                case 'members':
                    aVal = a.members.length;
                    bVal = b.members.length;
                    break;
                case 'camping':
                    aVal = a.camping_type;
                    bVal = b.camping_type;
                    break;
                case 'nights':
                    aVal = a.nights.length;
                    bVal = b.nights.length;
                    break;
                case 'students':
                    aVal = a.members.filter(m => m.is_child && (m.class === 'Baobab' || m.class === 'Olive')).length;
                    bVal = b.members.filter(m => m.is_child && (m.class === 'Baobab' || m.class === 'Olive')).length;
                    break;
                case 'payment':
                    aVal = a.outstanding || 0;
                    bVal = b.outstanding || 0;
                    break;
            }

            if (aVal < bVal) return sortState.families.ascending ? -1 : 1;
            if (aVal > bVal) return sortState.families.ascending ? 1 : -1;
            return 0;
        });
    }

    const getSortIndicator = (column) => {
        if (sortState.families.column === column) {
            return sortState.families.ascending ? ' ↑' : ' ↓';
        }
        return '';
    };

        // Totals summary
        const totalFamilies = families.length;
        const totalChildren = families.reduce((sum, f) => sum + f.members.filter(m => m.is_child).length, 0);
        const totalAdults = families.reduce((sum, f) => sum + f.members.filter(m => !m.is_child).length, 0);
        const totalPaid = families.reduce((sum, f) => sum + (f.total_paid || 0), 0);
        const totalUnpaid = families.reduce((sum, f) => sum + Math.max((f.outstanding || 0), 0), 0);

        container.innerHTML = `
                <p style="margin-bottom: 20px; color: var(--earth-brown);">
                    ${totalFamilies} Families | ${totalChildren} Children | ${totalAdults} Adults | £${totalPaid.toFixed(2)} paid | £${totalUnpaid.toFixed(2)} unpaid
                </p>
                <div style="overflow-x: auto;">
          <table>
            <thead>
              <tr>
                <th class="sortable" data-sort="booking" style="cursor: pointer;">Booking Ref${getSortIndicator('booking')}</th>
                <th class="sortable" data-sort="members" style="cursor: pointer;">Family Members${getSortIndicator('members')}</th>
                <th class="sortable" data-sort="camping" style="cursor: pointer;">Camping Type${getSortIndicator('camping')}</th>
                <th class="sortable" data-sort="nights" style="cursor: pointer;">Nights${getSortIndicator('nights')}</th>
                <th class="sortable" data-sort="students" style="cursor: pointer;">Sefton Park Students${getSortIndicator('students')}</th>
                <th class="sortable" data-sort="payment" style="cursor: pointer;">Payment Status${getSortIndicator('payment')}</th>
                <th>Delete</th>
              </tr>
            </thead>
            <tbody>
              ${sortedFamilies.map(family => {
        const children = family.members.filter(m => m.is_child);
        const adults = family.members.filter(m => !m.is_child);
        const seftonChildren = family.members.filter(m => m.is_child && (m.class === 'Baobab' || m.class === 'Olive'));

        return `
                  <tr>
                    <td>
                      <a href="#" 
                         class="action-edit-family"
                         data-access-key="${family.access_key}"
                         style="color: var(--forest-green); text-decoration: none; font-weight: bold; cursor: pointer;">
                        ${family.booking_ref}
                      </a>
                    </td>
                    <td>
                      ${children.length > 0 ? `<strong>Children:</strong> ${children.map(c => c.name).join(', ')}<br>` : ''}
                      ${adults.length > 0 ? `<strong>Adults:</strong> ${adults.map(a => a.name).join(', ')}` : ''}
                    </td>
                    <td>${family.camping_type === 'tent' ? '⛺ Tent' : '🚐 Campervan'}</td>
                    <td>${family.nights.join(', ')}</td>
                    <td>
                                            ${seftonChildren.map(c => `${c.name} (${c.class})`).join('<br>') || '-'}
                    </td>
                    <td>
                      ${(() => {
                const outstanding = family.outstanding || 0;
                const owed = family.total_owed || 0;
                const paid = family.total_paid || 0;
                let color, status;

                if (outstanding > 0) {
                    color = 'var(--sunset-orange)';
                    status = 'Not Paid';
                } else if (outstanding < 0) {
                    color = '#4169E1';
                    status = 'Overpaid';
                } else {
                    color = 'var(--bright-green)';
                    status = 'Paid ✓';
                }

                return `
                          <div style="color: ${color}; font-weight: bold;">
                            ${status}<br>
                            <small style="color: var(--earth-brown); font-weight: normal;">
                              Owed: £${owed.toFixed(2)}<br>
                              Paid: £${paid.toFixed(2)}<br>
                              ${outstanding !== 0 ? `Balance: £${outstanding.toFixed(2)}` : ''}
                            </small>
                          </div>
                        `;
            })()}
                    </td>
                    <td>
                      <button 
                        class="btn btn-warning btn-small action-delete-family" 
                        data-access-key="${family.access_key}"
                        data-booking-ref="${family.booking_ref}"
                        style="white-space: nowrap;"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                `;
    }).join('')}
            </tbody>
          </table>
        </div>
      `;

    // attach delegation for families container
    // We do this ONCE in DOMContentLoaded usually, but re-rendering replaces innerHTML.
    // So delegation should be on the container which is NOT replaced?
    // 'families-container' IS the container div. Its innerHTML is replaced.
    // So we should attach event listener to 'families-container' once in DOMContentLoaded.
    // But here I'm generating HTML. I need to make sure I don't attach listener every render if I put it here.
    // I will put the listener in DOMContentLoaded.
}

function sortSignups(column) {
    if (sortState.signups.column === column) {
        sortState.signups.ascending = !sortState.signups.ascending;
    } else {
        sortState.signups.column = column;
        sortState.signups.ascending = true;
    }
    renderActivitySignups();
}

function renderActivitySignups() {
    const container = document.getElementById('activities-container');

    if (activitySignups.length === 0) {
        container.innerHTML = '<p>No activity sign-ups yet.</p>';
        return;
    }

    // Sort signups if a column is selected
    let sortedSignups = [...activitySignups];
    if (sortState.signups.column) {
        sortedSignups.sort((a, b) => {
            let aVal, bVal;

            switch (sortState.signups.column) {
                case 'activity':
                    aVal = a.activity_name.toLowerCase();
                    bVal = b.activity_name.toLowerCase();
                    break;
                case 'time':
                    aVal = a.session_time;
                    bVal = b.session_time;
                    break;
                case 'booking':
                    aVal = a.booking_ref.toLowerCase();
                    bVal = b.booking_ref.toLowerCase();
                    break;
                case 'children':
                    aVal = a.children.length;
                    bVal = b.children.length;
                    break;
                case 'cost':
                    aVal = a.cost * a.children.length;
                    bVal = b.cost * b.children.length;
                    break;
            }

            if (aVal < bVal) return sortState.signups.ascending ? -1 : 1;
            if (aVal > bVal) return sortState.signups.ascending ? 1 : -1;
            return 0;
        });
    }

    const getSortIndicator = (column) => {
        if (sortState.signups.column === column) {
            return sortState.signups.ascending ? ' ↑' : ' ↓';
        }
        return '';
    };

    // Get family payment info for each signup
    const familyMap = new Map(families.map(f => [f.booking_ref, f]));

    // Compute totals summary
    const uniqueActivities = new Set(activitySignups.map(s => s.activity_name)).size;
    const totalChildren = activitySignups.reduce((sum, s) => sum + s.children.length, 0);
    // Count unique adults from signup children data - actually signups store children names, not adults
    // We need to count participants. Let's count total participants from all signups
    // Actually, the signups data has a 'children' array which are participant names
    // We need to determine if they're children or adults from the family data
    let totalAdults = 0;
    let totalChildrenCount = 0;
    activitySignups.forEach(signup => {
        const family = familyMap.get(signup.booking_ref);
        if (family) {
            signup.children.forEach(participantName => {
                const member = family.members.find(m => m.name === participantName);
                if (member) {
                    if (member.is_child) {
                        totalChildrenCount++;
                    } else {
                        totalAdults++;
                    }
                }
            });
        }
    });

    const totalCost = activitySignups.reduce((sum, s) => sum + (s.cost * s.children.length), 0);
    // For paid/unpaid, we sum family balances for families with signups
    const familiesWithSignups = new Set(activitySignups.map(s => s.booking_ref));
    let totalPaid = 0;
    let totalUnpaid = 0;
    familiesWithSignups.forEach(bookingRef => {
        const family = familyMap.get(bookingRef);
        if (family) {
            totalPaid += family.total_paid || 0;
            totalUnpaid += Math.max(family.outstanding || 0, 0);
        }
    });

    container.innerHTML = `
        <p style="margin-bottom: 20px; color: var(--earth-brown);">
          ${uniqueActivities} ${uniqueActivities === 1 ? 'Activity' : 'Activities'} | ${totalChildrenCount} Children | ${totalAdults} Adults | £${totalPaid.toFixed(2)} paid | £${totalUnpaid.toFixed(2)} unpaid
        </p>
        <div style="overflow-x: auto;">
          <table>
            <thead>
              <tr>
                <th class="sortable" data-sort="activity" style="cursor: pointer;">Activity${getSortIndicator('activity')}</th>
                <th class="sortable" data-sort="time" style="cursor: pointer;">Session Time${getSortIndicator('time')}</th>
                <th class="sortable" data-sort="booking" style="cursor: pointer;">Booking Ref${getSortIndicator('booking')}</th>
                <th class="sortable" data-sort="children" style="cursor: pointer;">Children${getSortIndicator('children')}</th>
                <th class="sortable" data-sort="cost" style="cursor: pointer;">Cost${getSortIndicator('cost')}</th>
                <th>Family Payment Status</th>
              </tr>
            </thead>
            <tbody>
              ${sortedSignups.map(signup => {
        const totalCost = signup.cost * signup.children.length;
        const family = familyMap.get(signup.booking_ref);
        const outstanding = family?.outstanding || 0;

        let statusColor, statusText;

        if (totalCost === 0) {
            statusText = '';
            statusColor = 'inherit';
        } else if (outstanding > 0) {
            statusColor = 'var(--sunset-orange)';
            statusText = `Not Paid (£${outstanding.toFixed(2)} owed)`;
        } else if (outstanding < 0) {
            statusColor = '#4169E1';
            statusText = `Overpaid (£${Math.abs(outstanding).toFixed(2)} credit)`;
        } else {
            statusColor = 'var(--bright-green)';
            statusText = 'Paid ✓';
        }

        return `
                  <tr>
                    <td><strong>${signup.activity_name}</strong></td>
                    <td>${signup.session_time}</td>
                    <td>${signup.booking_ref}</td>
                    <td>${signup.children.join(', ')}</td>
                    <td>£${totalCost.toFixed(2)}</td>
                    <td style="color: ${statusColor}; font-weight: bold;">
                      ${statusText}
                    </td>
                  </tr>
                `;
    }).join('')}
            </tbody>
          </table>
        </div>
      `;
}



async function exportFamilies() {
    try {
        const response = await fetch(`${API_URL}/export/families`);
        if (response.ok) {
            const data = await response.json();
            const csv = convertToCSV(data);
            await navigator.clipboard.writeText(csv);
            alert('Family data copied to clipboard! You can now paste it into Google Sheets.');
        }
    } catch (error) {
        console.error('Error exporting families:', error);
        alert('Error exporting data');
    }
}

async function exportActivities() {
    try {
        const response = await fetch(`${API_URL}/export/activities`);
        if (response.ok) {
            const data = await response.json();
            const csv = convertToCSV(data);
            await navigator.clipboard.writeText(csv);
            alert('Activity data copied to clipboard! You can now paste it into Google Sheets.');
        }
    } catch (error) {
        console.error('Error exporting activities:', error);
        alert('Error exporting data');
    }
}

function convertToCSV(data) {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvRows = [
        headers.join(','),
        ...data.map(row =>
            headers.map(header => {
                const value = row[header] || '';
                // Escape quotes and wrap in quotes if contains comma
                const escaped = String(value).replace(/"/g, '""');
                return escaped.includes(',') ? `"${escaped}"` : escaped;
            }).join(',')
        )
    ];

    return csvRows.join('\n');
}

let editMemberCount = 0;

async function editFamily(accessKey) {
    const family = families.find(f => f.access_key === accessKey);
    if (!family) return;

    // Populate the form
    document.getElementById('edit-family-id').value = family.id;
    document.getElementById('edit-family-access-key').value = family.access_key;
    document.getElementById('edit-booking-ref').value = family.booking_ref;
    document.querySelector(`input[name="edit-camping-type"][value="${family.camping_type}"]`).checked = true;

    // Set nights
    document.querySelectorAll('input[name="edit-nights"]').forEach(cb => {
        cb.checked = family.nights.includes(cb.value);
    });

    // Clear and populate members
    document.getElementById('edit-members-container').innerHTML = '';
    editMemberCount = 0;
    family.members.forEach(member => {
        addEditMember(member.is_child === 1, member);
    });

    // Show modal
    document.getElementById('edit-family-modal').style.display = 'flex';
}

function closeEditFamilyModal() {
    document.getElementById('edit-family-modal').style.display = 'none';
    document.getElementById('edit-family-form').reset();
}

function addEditMember(isChild, data = null) {
    editMemberCount++;
    const container = document.getElementById('edit-members-container');

    const memberCard = document.createElement('div');
    memberCard.className = `member-card ${isChild ? 'child' : ''}`;
    memberCard.id = `edit-member-${editMemberCount}`;

    memberCard.innerHTML = `
                <button type="button" class="remove-btn action-remove-edit-member" data-id="${editMemberCount}">×</button>
                <h4 style="color: var(--forest-green); margin-bottom: 15px;">
                    ${isChild ? '👦 Child' : '👨 Adult'}
                </h4>
                
                <div class="form-group">
                    <label>Name *</label>
                    <input 
                        type="text" 
                        name="edit-member-name-${editMemberCount}" 
                        value="${data?.name || ''}"
                        required
                    >
                </div>

                <input type="hidden" name="edit-member-is-child-${editMemberCount}" value="${isChild ? '1' : '0'}">

                ${isChild ? `
                    <div class="form-group">
                       <label>Class / Group *</label>
                       <div class="checkbox-group">
                           <label class="checkbox-label">
                               <input type="radio" name="edit-member-class-${editMemberCount}" value="Baobab" ${data?.class === 'Baobab' ? 'checked' : ''} required>
                               <span>Baobab</span>
                           </label>
                           <label class="checkbox-label">
                               <input type="radio" name="edit-member-class-${editMemberCount}" value="Olive" ${data?.class === 'Olive' ? 'checked' : ''}>
                               <span>Olive</span>
                           </label>
                           <label class="checkbox-label">
                               <input type="radio" name="edit-member-class-${editMemberCount}" value="Other" ${(data?.class && data.class !== 'Baobab' && data.class !== 'Olive') ? 'checked' : ''}>
                               <span>Other / Sibling</span>
                           </label>
                       </div>
                    </div>
                ` : ''}
            `;

    container.appendChild(memberCard);

    // Add event listeners
    if (isChild) {
        // No specific listeners needed
    }
}

function removeEditMember(id) {
    const member = document.getElementById(`edit-member-${id}`);
    if (member) member.remove();
}

document.getElementById('edit-family-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(e.target);
    const familyId = document.getElementById('edit-family-id').value;
    const bookingRef = document.getElementById('edit-booking-ref').value;
    const campingType = formData.get('edit-camping-type');
    const nights = formData.getAll('edit-nights');

    if (nights.length === 0) {
        alert('Please select at least one night');
        return;
    }

    // Collect members
    const members = [];
    const memberCards = document.querySelectorAll('#edit-members-container .member-card');

    memberCards.forEach((card) => {
        const id = card.id.split('-')[2];
        const name = formData.get(`edit-member-name-${id}`);
        const isChild = formData.get(`edit-member-is-child-${id}`) === '1';
        // Logic for class
        const classValue = isChild ? formData.get(`edit-member-class-${id}`) : null;

        if (name) {
            members.push({
                name,
                is_child: isChild,
                class: classValue
            });
        }
    });

    if (members.length === 0) {
        alert('Please add at least one family member');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/families`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                booking_ref: bookingRef,
                members,
                camping_type: campingType,
                nights
            })
        });

        if (response.ok) {
            closeEditFamilyModal();
            await loadFamilies();
            alert('Family registration updated successfully! 🎉');
        } else {
            alert('Error updating family registration');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error updating family registration');
    }
});

async function deleteFamily(accessKey, bookingRef) {
    if (!confirm(`Are you sure you want to delete the registration for booking reference "${bookingRef}"? This cannot be undone.`)) {
        return;
    }

    try {
        // We need to add a DELETE endpoint on the server
        const family = families.find(f => f.access_key === accessKey);
        if (!family) return;

        const response = await fetch(`${API_URL}/families/${family.id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            await loadFamilies();
            alert('Family registration deleted successfully');
        } else {
            alert('Error deleting family registration');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error deleting family registration');
    }
}

async function deleteActivity() {
    const activityId = document.getElementById('edit-activity-id').value;
    const activityName = document.getElementById('edit-activity-name').value;

    if (!confirm(`Are you sure you want to delete "${activityName}"? This will also remove all sign-ups for this activity. This cannot be undone.`)) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/activities/${activityId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            closeEditModal();
            await loadAllActivities();
            await loadActivitySignups();
            alert('Activity deleted successfully');
        } else {
            alert('Error deleting activity');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error deleting activity');
    }
}

document.getElementById('add-activity-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('activity-name').value;
    const session_time = document.getElementById('activity-time').value;
    const cost = parseFloat(document.getElementById('activity-cost').value) || 0;
    const description = document.getElementById('activity-description').value;
    const max_participants = parseInt(document.getElementById('activity-max-participants').value) || 0;

    try {
        const response = await fetch(`${API_URL}/activities`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name,
                session_time,
                cost,
                description,
                cost,
                description,
                max_participants,
                allowed_ages: (() => {
                    const child = document.getElementById('add-activity-allow-child').checked;
                    const adult = document.getElementById('add-activity-allow-adult').checked;
                    if (child && adult) return 'both';
                    if (child) return 'child';
                    if (adult) return 'adult';
                    return 'both'; // Default fallback
                })()
            })
        });

        if (response.ok) {
            closeAddModal();
            await loadAllActivities();
            alert('Activity added successfully! 🎉');
        } else {
            alert('Error adding activity');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error adding activity');
    }
});

// ===== BACKUP FUNCTIONS =====

async function loadBackups() {
    try {
        backups = await fetchJSON(`${API_URL}/backups`);
        renderBackups();
    } catch (error) {
        document.getElementById('backups-container').innerHTML = '<p class="alert alert-error">Error loading backups</p>';
    }
}

function renderBackups() {
    const container = document.getElementById('backups-container');

    if (backups.length === 0) {
        container.innerHTML = '<p>No backups available yet. Create your first backup using the button above.</p>';
        return;
    }

    container.innerHTML = `
                    <div style="overflow-x: auto;">
                        <table>
                            <thead>
                                <tr>
                                    <th>Backup Date</th>
                                    <th>File Name</th>
                                    <th>Size</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${backups.map(backup => `
                                    <tr>
                                        <td>${new Date(backup.created).toLocaleString()}</td>
                                        <td><code style="font-size: 0.85em;">${backup.name}</code></td>
                                        <td>${formatBytes(backup.size)}</td>
                                        <td>
                                            <div style="display: flex; gap: 5px;">
                                                <button class="btn btn-primary btn-small action-download-backup" data-filename="${backup.name}">
                                                    ⬇️ Download
                                                </button>
                                                <button class="btn btn-warning btn-small action-delete-backup" data-filename="${backup.name}">
                                                    🗑️ Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    <p style="margin-top: 20px; color: var(--earth-brown);">
                        <strong>Total Backups:</strong> ${backups.length} | 
                        <strong>Total Size:</strong> ${formatBytes(backups.reduce((sum, b) => sum + b.size, 0))}
                    </p>
                `;
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

async function createBackup() {
    if (!confirm('Create a backup now?\\n\\nThis will create a copy of the current database.')) {
        return;
    }

    try {
        const result = await fetchJSON(`${API_URL}/backups`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (result.success) {
            showAlert(`Backup created successfully: ${result.fileName}`, 'success');
            await loadBackups();
        } else {
            showAlert('Error creating backup', 'error');
        }
    } catch (error) {
        console.error('Error creating backup:', error);
        showAlert('Error creating backup', 'error');
    }
}

function downloadBackup(fileName) {
    window.location.href = `${API_URL}/backups/${fileName}`;
}

async function deleteBackup(fileName) {
    if (!confirm(`Delete backup "${fileName}"?\\n\\nThis action cannot be undone.`)) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/backups/${fileName}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.ok) {
            showAlert('Backup deleted successfully', 'success');
            await loadBackups();
        } else {
            showAlert('Error deleting backup', 'error');
        }
    } catch (error) {
        console.error('Error deleting backup:', error);
        showAlert('Error deleting backup', 'error');
    }
}
