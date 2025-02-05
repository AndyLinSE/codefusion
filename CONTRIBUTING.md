# Contributing to CodeFusion

First off, thank you for considering contributing to CodeFusion! It's people like you that make CodeFusion such a great tool.

## Code of Conduct

By participating in this project, you are expected to uphold our Code of Conduct:
- Be respectful of others
- Use welcoming and inclusive language
- Be collaborative
- Focus on what is best for the community

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

- Use a clear and descriptive title
- Describe the exact steps which reproduce the problem
- Provide specific examples to demonstrate the steps
- Describe the behavior you observed after following the steps
- Explain which behavior you expected to see instead and why
- Include screenshots if possible

### Suggesting Enhancements

If you have a suggestion for the project:

- Use a clear and descriptive title
- Provide a step-by-step description of the suggested enhancement
- Provide specific examples to demonstrate the steps
- Describe the current behavior and explain which behavior you expected to see instead

### Pull Requests

1. Fork the repo and create your branch from `main`
2. If you've added code that should be tested, add tests
3. Ensure the test suite passes
4. Make sure your code follows the existing code style
5. Include appropriate documentation
6. Issue that pull request!

## Development Process

1. **Setup Development Environment**
   ```powershell
   git clone <your-fork>
   cd codefusion
   npm install
   ```

2. **Run the Development Server**
   ```powershell
   npm start
   ```

3. **Build for Production**
   ```powershell
   npm run build
   ```

## Styleguides

### Git Commit Messages
- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests liberally after the first line

### JavaScript Styleguide
- Use 2 spaces for indentation
- Use semicolons
- Use `const` for all of your references; avoid using `var`
- Use template literals instead of string concatenation
- Use meaningful variable names

### Documentation Styleguide
- Use Markdown
- Reference functions and classes in backticks: \`functionName()\`
- Include code examples when possible
- Keep line length to a maximum of 80 characters

## Additional Notes

### Issue and Pull Request Labels

- `bug`: Something isn't working
- `enhancement`: New feature or request
- `documentation`: Improvements or additions to documentation
- `good first issue`: Good for newcomers
- `help wanted`: Extra attention is needed 