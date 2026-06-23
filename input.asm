.text
addi x1, x0, 5
add  x2, x1, x1
beq  x1, x2, end
sub  x3, x2, x1
jal  x0, end
end:
addi x4, x0, 1
