import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AmountCalculator } from '@/components/forms/AmountCalculator';

describe('amount calculator', () => {
  it('withholds unfinished expressions and emits the calculated amount', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AmountCalculator value="" onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: '1' }));
    await user.click(screen.getByRole('button', { name: '2' }));
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await user.click(screen.getByRole('button', { name: '3' }));
    expect(onChange).toHaveBeenLastCalledWith('');

    await user.click(screen.getByRole('button', { name: 'Equals' }));
    expect(onChange).toHaveBeenLastCalledWith('15');
  });

  it('calculates a directly typed expression when Enter is pressed', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AmountCalculator value="" onChange={onChange} />);

    const input = screen.getByRole('textbox', { name: 'Calculate amount' });
    await user.type(input, '12.50+2.25');
    expect(fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })).toBe(false);

    expect(input).toHaveValue('14.75');
    expect(onChange).toHaveBeenLastCalledWith('14.75');
  });

  it('accepts direct decimal typing and a formatted pasted amount', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AmountCalculator value="" onChange={onChange} />);

    const input = screen.getByRole('textbox', { name: 'Calculate amount' });
    await user.type(input, '42.50');
    expect(onChange).toHaveBeenLastCalledWith('42.50');

    await user.clear(input);
    await user.click(input);
    await user.paste('1,234.56');

    expect(input).toHaveValue('1234.56');
    expect(onChange).toHaveBeenLastCalledWith('1234.56');
  });
});
