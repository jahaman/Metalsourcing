// Admin: confirm before removing a die
document.addEventListener('submit', event => {
	const form = event.target;

	if (form.querySelector('input[name="delete"]') && !form.dataset.confirmed) {
		const button = form.querySelector('button');

		if (button && button.dataset.armed !== '1') {
			event.preventDefault();
			button.dataset.armed = '1';
			button.textContent = 'Click again to remove';
			setTimeout(() => { button.dataset.armed = ''; button.textContent = 'Remove'; }, 3000);
		}
	}
});
