const { Category } = require('../backend/models');

const seedCategories = async () => {
  const categories = [
    { name: "Fruits", spicy: false },
    { name: "Movies", spicy: true },
    { name: "Animals", spicy: false },
    { name: "Celebrities", spicy: true },
  ];

  await Category.bulkCreate(categories);
  console.log("Categories seeded!");
};

seedCategories();
