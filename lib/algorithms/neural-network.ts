// Simple Neural Network for Character Prediction
export class SimpleNeuralNetwork {
  private inputSize: number
  private hiddenSize: number
  private outputSize: number
  private weightsIH: number[][] = []
  private weightsHO: number[][] = []
  private biasH: number[] = []
  private biasO: number[] = []
  
  constructor(inputSize: number, hiddenSize: number, outputSize: number) {
    this.inputSize = inputSize
    this.hiddenSize = hiddenSize
    this.outputSize = outputSize
    
    // Initialize weights with small random values
    this.weightsIH = Array(hiddenSize).fill(0).map(() =>
      Array(inputSize).fill(0).map(() => (Math.random() - 0.5) * 0.1)
    )
    
    this.weightsHO = Array(outputSize).fill(0).map(() =>
      Array(hiddenSize).fill(0).map(() => (Math.random() - 0.5) * 0.1)
    )
    
    this.biasH = Array(hiddenSize).fill(0).map(() => (Math.random() - 0.5) * 0.1)
    this.biasO = Array(outputSize).fill(0).map(() => (Math.random() - 0.5) * 0.1)
  }
  
  // ReLU activation
  private relu(x: number): number {
    return Math.max(0, x)
  }
  
  // Softmax for output layer
  private softmax(arr: number[]): number[] {
    const max = Math.max(...arr)
    const exp = arr.map(x => Math.exp(x - max))
    const sum = exp.reduce((a, b) => a + b, 0)
    return exp.map(x => x / sum)
  }
  
  // Forward pass
  predict(input: number[]): number[] {
    // Input to hidden
    const hidden = this.biasH.map((bias, i) => {
      const sum = input.reduce((acc, val, j) => acc + val * this.weightsIH[i][j], 0) + bias
      return this.relu(sum)
    })
    
    // Hidden to output
    const output = this.biasO.map((bias, i) => {
      const sum = hidden.reduce((acc, val, j) => acc + val * this.weightsHO[i][j], 0) + bias
      return sum
    })
    
    return this.softmax(output)
  }
  
  // One-hot encode character
  static encodeChar(char: string, charSet: string): number[] {
    const index = charSet.indexOf(char)
    const encoded = Array(charSet.length).fill(0)
    if (index >= 0) {
      encoded[index] = 1
    }
    return encoded
  }
  
  // Decode one-hot to character
  static decodeChar(probabilities: number[], charSet: string): string {
    const maxIndex = probabilities.indexOf(Math.max(...probabilities))
    return charSet[maxIndex] || ' '
  }
  
  // Train on sequence (simple backpropagation)
  train(inputs: number[][], targets: number[][], learningRate: number = 0.01): void {
    // Simplified training - just update weights based on error
    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i]
      const target = targets[i]
      
      // Forward pass
      const hidden = this.biasH.map((bias, h) => {
        const sum = input.reduce((acc, val, j) => acc + val * this.weightsIH[h][j], 0) + bias
        return this.relu(sum)
      })
      
      const output = this.biasO.map((bias, o) => {
        const sum = hidden.reduce((acc, val, h) => acc + val * this.weightsHO[o][h], 0) + bias
        return sum
      })
      const outputSoftmax = this.softmax(output)
      
      // Compute error
      const outputError = outputSoftmax.map((o, idx) => o - target[idx])
      
      // Update output weights
      for (let o = 0; o < this.outputSize; o++) {
        for (let h = 0; h < this.hiddenSize; h++) {
          this.weightsHO[o][h] -= learningRate * outputError[o] * hidden[h]
        }
        this.biasO[o] -= learningRate * outputError[o]
      }
      
      // Compute hidden error
      const hiddenError = hidden.map((h, idx) => {
        let error = 0
        for (let o = 0; o < this.outputSize; o++) {
          error += outputError[o] * this.weightsHO[o][idx]
        }
        return error * (h > 0 ? 1 : 0) // ReLU derivative
      })
      
      // Update input weights
      for (let h = 0; h < this.hiddenSize; h++) {
        for (let i = 0; i < this.inputSize; i++) {
          this.weightsIH[h][i] -= learningRate * hiddenError[h] * input[i]
        }
        this.biasH[h] -= learningRate * hiddenError[h]
      }
    }
  }
}

// Pre-trained network for common error message patterns
export function createPreTrainedNetwork(charSet: string): SimpleNeuralNetwork {
  const network = new SimpleNeuralNetwork(10 * charSet.length, 64, charSet.length)
  
  // Train on common patterns
  const trainingData = [
    '404 NOT FOUND',
    'ERROR 404',
    'PAGE MISSING',
    'DOES NOT EXIST',
    'NULL REFERENCE',
    'UNDEFINED',
    '0x1A4 ERROR',
    'SEGMENTATION FAULT',
  ]
  
  // Simple training on sequences
  for (const text of trainingData) {
    for (let i = 0; i < text.length - 1; i++) {
      const context = text.slice(Math.max(0, i - 9), i + 1)
      const nextChar = text[i + 1]
      
      // Pad context to 10 chars
      const paddedContext = context.padStart(10, ' ').slice(-10)
      const input = paddedContext
        .split('')
        .flatMap(c => SimpleNeuralNetwork.encodeChar(c, charSet))
      
      const target = SimpleNeuralNetwork.encodeChar(nextChar, charSet)
      
      network.train([input], [target], 0.1)
    }
  }
  
  return network
}

