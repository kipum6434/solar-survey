# Signature Section Redesign Notes

## Current Issues (from user screenshots):
1. Signature images are too small and floating
2. Customer and technician signature lines are not equal width
3. Signer name and "ยังไม่ได้เซ็น" text are at different levels
4. Date is placed separately to the right, disconnected from signature boxes
5. Both signature columns are not balanced
6. Spacing is inconsistent

## Current Code (lines 1086-1146 in pdfExport.ts):
- Uses `columns` layout with two stacks
- Signature image: width 100, height 50, fit [100, 50] - TOO SMALL
- Line: canvas line from x1:20 to x2:140 - NOT CENTERED
- Date is a separate element aligned right

## Redesign Plan:
- Make signature images larger: width 150, height 70
- Center the signature line properly using full column width
- Put both columns in a bordered table for visual balance
- Include date INSIDE the signature section, centered below both columns
- Make "ยังไม่ได้เซ็น" same height as signature image space
- Use consistent spacing and alignment
- Add a light border/box around the entire signature area for formality
