import { runTests } from './addon.test.js';

runTests()
  .then((res) => {
    if (res.failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  })
  .catch((err) => {
    console.error('Test run failed with unhandled error:', err);
    process.exit(1);
  });
