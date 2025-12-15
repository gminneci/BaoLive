window.addEventListener('DOMContentLoaded', async () => {
  try {
    const activities = await fetchJSON(`${API_URL}/public/participants`);
    renderActivities(activities);
  } catch (error) {
    document.getElementById('content-container').innerHTML =
      '<div class="card"><p class="alert alert-error">Error loading data. Please try again later.</p></div>';
  }
});

function renderActivities(activities) {
  const container = document.getElementById('content-container');

  if (activities.length === 0) {
    container.innerHTML = '<div class="card"><p>No activities found.</p></div>';
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'activity-grid';

  activities.forEach(activity => {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';

    const count = activity.participants.length;

    card.innerHTML = `
      <div style="flex: 1;">
        <h3 style="color: var(--forest-green); margin-bottom: 5px;">${activity.name}</h3>
        <div style="font-weight: 600; color: var(--earth-brown); font-size: 0.9em; margin-bottom: 10px;">
          ${activity.session_time}
        </div>
        <p style="font-size: 0.9em; color: #666; margin-bottom: 15px;">
          ${activity.description || ''}
        </p>
      </div>
      
      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <strong style="color: var(--leaf-green);">Participants</strong>
          <span class="badge" style="background: var(--light-cream); color: var(--forest-green);">
            ${count} ${activity.max_participants > 0 ? `/ ${activity.max_participants}` : ''}
          </span>
        </div>
        
        ${count > 0 ? `
          <ul class="participant-list">
            ${activity.participants.map(name => `<li>${name}</li>`).join('')}
          </ul>
        ` : `
          <div class="empty-list">No one signed up yet! Be the first!</div>
        `}
      </div>
    `;
    grid.appendChild(card);
  });

  container.innerHTML = '';
  container.appendChild(grid);
}
