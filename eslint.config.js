import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
	{ ignores: ['dist', 'src/wasm', 'node_modules'] },
	...tseslint.configs.recommended,
	prettier,
	{
		rules: {
			'@typescript-eslint/switch-exhaustiveness-check': 'off',
		},
	},
)
