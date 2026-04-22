// Page transition orchestration
// CSS classes are defined in animations.css — this file handles timing

function staggerItems(container, selector) {
  const items = container.querySelectorAll(selector);
  items.forEach((item, i) => {
    item.classList.add('stagger-enter', 'stagger-delay-' + Math.min(i, 9));
  });

  setTimeout(() => {
    items.forEach(item => {
      item.classList.remove('stagger-enter');
      for (let j = 0; j <= 9; j++) {
        item.classList.remove('stagger-delay-' + j);
      }
    });
  }, 600);
}
